import 'server-only';
import { StatsTab, type SeasonSummary, MmrTab, type RankPoint } from '@/components/player/Tabs';
import { ErrorState } from '@/components/ErrorState';
import { toErrorView } from '@/core/errors';
import { mean, mapLimit } from '@/core/math';
import { loadPlayer, loadProfile } from '@/server/player';
import { History, type HistoryRow, Champions, type ChampionRow } from '@/components/player/History';
import { breakdown, CATEGORY_ES, ROLE_NAMES } from '@/games/lol/metrics';
import { rankLabel } from '@/games/lol/ranks';
import { getRepo } from '@/server/repo';
import { Improve, type CategoryRow, type ChampLine, type DeathKind, type DeathSummary, type Example, type GameRef, type Killer, type Kpi, type Pattern, type PlanItem, type Trend } from '@/components/player/Improve';
import { ADVICE_SOURCES, insightName } from '@/lib/insights';
import { scoreColor } from '@/lib/format';
import type { Advice } from '@/core/types';
import { analyse, baselineOf } from '@/games/lol/analysis';
import type { MatchDto } from '@/games/lol/dto';
import { persistentSource } from '@/server/persistent';

/** Server bodies of the five profile tabs; the profile page renders all of them in one pass. */

export async function StatsPanel({ slug }: { slug: string }) {
  const { rows, player } = await loadPlayer(slug);
  const games = rows.filter((r) => !r.remake);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const min = (r: (typeof games)[number]) => Math.max(1, r.durationSec / 60);
  const season: SeasonSummary = {
    games: games.length,
    wins: games.filter((r) => r.win).length,
    kda: games.length ? ((mean(games.map((r) => r.k)) + mean(games.map((r) => r.a))) / Math.max(1, mean(games.map((r) => r.d)))).toFixed(2) : '—',
    csPerMin: games.length ? mean(games.map((r) => r.cs / min(r))).toFixed(1) : '—',
    kp: games.length ? pct(mean(games.map((r) => r.killParticipation))) : '—',
    dmgShare: games.length ? pct(mean(games.map((r) => r.damageShare))) : '—',
    visionPerMin: games.length ? mean(games.map((r) => r.visionScore / min(r))).toFixed(2) : '—',
    score: games.length ? mean(games.map((r) => r.score)).toFixed(1) : '—',
  };
  try {
    return <StatsTab data={await loadProfile(slug)} season={season} />;
  } catch (e) {
    return <ErrorState error={toErrorView(e)} game="lol" region={player.region} />;
  }
}

export async function HistoryPanel({ slug }: { slug: string }) {
  const { rows, dd, player } = await loadPlayer(slug);
  const list: HistoryRow[] = rows.map((r) => ({
    matchId: r.matchId,
    endedAt: r.endedAt,
    durationSec: r.durationSec,
    win: r.win,
    remake: r.remake,
    champion: dd.championName(r.champion),
    image: dd.championImg(r.champion),
    role: ROLE_NAMES[r.role] ?? '—',
    k: r.k,
    d: r.d,
    a: r.a,
    cs: r.cs,
    cs10: r.cs10,
    kp: r.killParticipation,
    dmgShare: r.damageShare,
    vision: r.visionScore,
    score: r.score,
    mvp: !r.remake && r.win && r.teamPlace === 1,
    ace: !r.remake && !r.win && r.teamPlace === 1,
    place: r.place ?? null,
    lpDelta: r.lpDelta,
    opponent: r.opponent ? { champion: dd.championName(r.opponent), image: dd.championImg(r.opponent) } : null,
    items: r.items.map(dd.itemImg),
  }));
  return <History rows={list} slug={player.slug} />;
}

export async function ChampionsPanel({ slug }: { slug: string }) {
  const { rows, dd } = await loadPlayer(slug);
  const by = new Map<string, typeof rows>();
  for (const r of rows.filter((x) => !x.remake)) by.set(r.champion, [...(by.get(r.champion) ?? []), r]);
  const list: ChampionRow[] = [...by.entries()].map(([c, rs]) => {
    const vs = new Map<string, { games: number; wins: number }>();
    for (const r of rs) if (r.opponent) {
      const m = vs.get(r.opponent) ?? { games: 0, wins: 0 };
      vs.set(r.opponent, { games: m.games + 1, wins: m.wins + (r.win ? 1 : 0) });
    }
    return {
      champion: dd.championName(c),
      image: dd.championImg(c),
      games: rs.length,
      wins: rs.filter((r) => r.win).length,
      kda: (mean(rs.map((r) => r.k)) + mean(rs.map((r) => r.a))) / Math.max(1, mean(rs.map((r) => r.d))),
      csPerMin: mean(rs.map((r) => r.cs / Math.max(1, r.durationSec / 60))),
      cs10: mean(rs.map((r) => r.cs10)),
      kp: mean(rs.map((r) => r.killParticipation)),
      dmgShare: mean(rs.map((r) => r.damageShare)),
      score: mean(rs.map((r) => r.score)),
      lastPlayed: Math.max(...rs.map((r) => r.endedAt)),
      matchups: [...vs.entries()].sort((a, b) => b[1].games - a[1].games).map(([o, v]) => ({ champion: dd.championName(o), image: dd.championImg(o), ...v })),
    };
  });
  return <Champions rows={list} />;
}

export async function MmrPanel({ slug }: { slug: string }) {
  const { player, rows } = await loadPlayer(slug);
  const seasonStart = rows.length ? Math.min(...rows.map((r) => r.endedAt)) : 0;
  const snaps = (await getRepo().snapshots(player.puuid)).filter((s) => s.queueType === 'RANKED_SOLO_5x5' && s.takenAt >= seasonStart - 86400_000);
  const history: RankPoint[] = snaps.map((s) => {
    const l = rankLabel(s.rating);
    return { at: s.takenAt, rating: s.rating, label: l.label, color: l.color };
  });
  try {
    return <MmrTab data={await loadProfile(slug)} history={history} owner={{ game: 'lol', puuid: player.puuid }} />;
  } catch (e) {
    return <ErrorState error={toErrorView(e)} game="lol" region={player.region} />;
  }
}

const ANALYSED = 10;

export async function ImprovePanel({ slug }: { slug: string }) {
  try {
    return await improveBody(slug);
  } catch (e) {
    const { player } = await loadPlayer(slug);
    return <ErrorState error={toErrorView(e)} game="lol" region={player.region} />;
  }
}

async function improveBody(slug: string) {
  const { player, rows, dd } = await loadPlayer(slug);
  const games = rows.filter((r) => !r.remake);
  if (!games.length) return <Improve empty />;
  const src = persistentSource();

  // Personal baseline and category scores over up to 30 games; deep analysis (timelines) of the last 10.
  const recent = (await mapLimit(games.slice(0, 30), 6, (r) => src.match(player.region, r.matchId).catch(() => null))).filter((m): m is MatchDto => !!m);
  const base = baselineOf(recent, player.puuid);
  const rowOf = new Map(games.map((r) => [r.matchId, r]));
  const analysed = (
    await mapLimit(recent.slice(0, ANALYSED), 3, async (m) => {
      const tl = await src.timeline(player.region, m.metadata.matchId).catch(() => null);
      const a = analyse(m, tl, player.puuid, dd, base);
      const r = rowOf.get(m.metadata.matchId)!;
      const ref: GameRef = { matchId: r.matchId, champion: dd.championName(r.champion), image: dd.championImg(r.champion), win: r.win, endedAt: r.endedAt, score: r.score, grade: a.grade, kda: `${r.k}/${r.d}/${r.a}`, mvp: r.win && r.teamPlace === 1 };
      return { ref, a };
    })
  ).sort((x, y) => y.ref.endedAt - x.ref.endedAt);
  const refs = analysed.map((g) => g.ref);

  // Patterns: the same insight across games, with the most telling real examples.
  const patterns = (good: boolean): Pattern[] => {
    const by = new Map<string, Pattern & { inst: (Example & { sev: number })[] }>();
    for (const g of analysed)
      for (const it of good ? g.a.strengths : g.a.mistakes) {
        const p = by.get(it.id) ?? { id: it.id, category: it.category, name: insightName(it.id, good, it.title), count: 0, severity: 0, games: [], examples: [], inst: [] };
        if (!p.games.includes(g.ref.matchId)) {
          p.count++;
          p.games.push(g.ref.matchId);
        }
        p.severity += it.severity;
        p.inst.push({ game: g.ref, title: it.title, detail: it.detail, minute: it.minute, sev: it.severity });
        by.set(it.id, p);
      }
    return [...by.values()]
      .map(({ inst, ...p }) => ({ ...p, examples: inst.sort((a, b) => b.sev - a.sev || b.game.endedAt - a.game.endedAt).slice(0, 4).map((x): Example => ({ game: x.game, title: x.title, detail: x.detail, minute: x.minute })) }))
      .sort((x, y) => y.count - x.count || y.severity - x.severity);
  };
  const mistakes = patterns(false);
  const strengths = patterns(true);

  // Plan: the advice that repeats most, each with real moments from your games.
  const adv = new Map<string, { advice: Advice; games: string[] }>();
  for (const g of analysed)
    for (const ad of g.a.advice) {
      const x = adv.get(ad.id) ?? { advice: ad, games: [] };
      x.games.push(g.ref.matchId);
      adv.set(ad.id, x);
    }
  const plan: PlanItem[] = [...adv.values()]
    .sort((a, b) => b.games.length - a.games.length)
    .slice(0, 3)
    .map(({ advice, games: gs }) => {
      const sources = ADVICE_SOURCES[advice.id] ?? [];
      const ex = mistakes.filter((m) => sources.includes(m.id)).flatMap((m) => m.examples);
      return { id: advice.id, category: advice.category, title: advice.title, how: advice.how, count: gs.length, games: gs, examples: ex.slice(0, 2) };
    });

  // Category scores: last 10 games vs the 20 before.
  const cat = (ms: MatchDto[]) => {
    const bs = ms.map((m) => breakdown(m, player.puuid));
    return Object.keys(CATEGORY_ES).map((k) => (bs.length ? mean(bs.map((b) => b[k as keyof typeof b])) : null));
  };
  const nowCat = cat(recent.slice(0, 10));
  const beforeCat = recent.length > 12 ? cat(recent.slice(10)) : Object.keys(CATEGORY_ES).map(() => null);
  const categories: CategoryRow[] = Object.entries(CATEGORY_ES).map(([key, label], i) => ({ key, label, recent: nowCat[i] ?? 0, before: beforeCat[i] }));

  // How you die.
  const allDeaths = analysed.flatMap((g) => g.a.deaths.map((d) => ({ d, game: g.ref })));
  const kinds: DeathKind[] = (['gank', 'solo', 'caught', 'teamfight', 'dive', 'skirmish'] as const)
    .map((kind) => {
      const ds = allDeaths.filter((x) => x.d.kind === kind);
      const ex = ds.find((x) => x.d.objectiveLost) ?? ds[0];
      return { kind, count: ds.length, example: ex ? { game: ex.game, title: `${ex.d.zone} · ${ex.d.killers.map((k) => k.champion).join(' + ')}`, detail: ex.d.note, minute: ex.d.minute } : null };
    })
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count);
  const killerCount = new Map<string, Killer>();
  for (const { d } of allDeaths)
    for (const k of d.killers) {
      const x = killerCount.get(k.champion) ?? { champion: k.champion, image: k.image, count: 0 };
      x.count++;
      killerCount.set(k.champion, x);
    }
  const n = Math.max(1, analysed.length);
  const deaths: DeathSummary = {
    total: allDeaths.length,
    perGame: allDeaths.length / n,
    early: allDeaths.filter((x) => x.d.minute < 14).length / n,
    objectives: allDeaths.filter((x) => x.d.objectiveLost).length,
    kinds,
    killers: [...killerCount.values()].sort((a, b) => b.count - a.count).slice(0, 4),
  };

  // Headline numbers: last 10 vs season.
  const min = (r: (typeof games)[number]) => Math.max(1, r.durationSec / 60);
  const last = games.slice(0, 10);
  const kpi = (label: string, f: (rs: typeof games) => number, fmtv: (v: number) => string, higherIsBetter = true): Kpi => {
    const now = f(last), season = f(games);
    const diff = now - season;
    return { label, now: fmtv(now), season: fmtv(season), better: Math.abs(diff) < Math.abs(season) * 0.03 ? null : higherIsBetter ? diff > 0 : diff < 0, color: label === 'Nota media' ? scoreColor(now) : undefined };
  };
  const kpis: Kpi[] = [
    kpi('Nota media', (rs) => mean(rs.map((r) => r.score)), (v) => v.toFixed(1)),
    kpi('% victorias', (rs) => (100 * rs.filter((r) => r.win).length) / Math.max(1, rs.length), (v) => `${Math.round(v)}%`),
    kpi('KDA', (rs) => (mean(rs.map((r) => r.k)) + mean(rs.map((r) => r.a))) / Math.max(1, mean(rs.map((r) => r.d))), (v) => v.toFixed(2)),
    kpi('Muertes / partida', (rs) => mean(rs.map((r) => r.d)), (v) => v.toFixed(1), false),
    kpi('CS / min', (rs) => mean(rs.map((r) => r.cs / min(r))), (v) => v.toFixed(1)),
    kpi('Visión / min', (rs) => mean(rs.map((r) => r.visionScore / min(r))), (v) => v.toFixed(2)),
  ];

  // Champions over the last 30 games.
  const byChamp = new Map<string, typeof games>();
  for (const r of games.slice(0, 30)) byChamp.set(r.champion, [...(byChamp.get(r.champion) ?? []), r]);
  const champs: ChampLine[] = [...byChamp.entries()]
    .filter(([, rs]) => rs.length >= 2)
    .map(([c, rs]) => ({ champion: dd.championName(c), image: dd.championImg(c), games: rs.length, wins: rs.filter((r) => r.win).length, score: mean(rs.map((r) => r.score)) }))
    .sort((a, b) => b.score - a.score);

  // Trends (last 30, oldest → newest) against the season average.
  const chrono = games.slice(0, 30).reverse();
  const trend = (label: string, f: (r: (typeof games)[number]) => number, fmtv: (v: number) => string, higherIsBetter = true): Trend => {
    const season = mean(games.map(f));
    const now = mean(games.slice(0, 10).map(f));
    return { label, values: chrono.map(f), seasonAvg: season, season: fmtv(season), last10: fmtv(now), better: higherIsBetter ? now >= season : now <= season };
  };
  const trends: Trend[] = [
    trend('Nota de rendimiento', (r) => r.score, (v) => v.toFixed(1)),
    trend('CS @10', (r) => r.cs10, (v) => v.toFixed(0)),
    trend('CS / min', (r) => r.cs / min(r), (v) => v.toFixed(1)),
    trend('Muertes', (r) => r.d, (v) => v.toFixed(1), false),
    trend('Participación en kills', (r) => r.killParticipation * 100, (v) => `${v.toFixed(0)}%`),
    trend('Visión / min', (r) => r.visionScore / min(r), (v) => v.toFixed(2)),
    trend('Wards de control', (r) => r.controlWards, (v) => v.toFixed(1)),
    trend('Daño del equipo', (r) => r.damageShare * 100, (v) => `${v.toFixed(0)}%`),
  ];

  return <Improve slug={player.slug} games={refs} kpis={kpis} plan={plan} mistakes={mistakes} strengths={strengths} categories={categories} deaths={deaths} champs={champs} trends={trends} />;
}
