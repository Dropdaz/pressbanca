import 'server-only';
import { RateLimitError } from '@/core/errors';
import { estimate, reach, type LobbyObservation } from '@/core/estimator';
import { convergeGames, forecastLp, gapFromLp, LP_ANCHOR_SD, mmrSwing, winChance } from '@/core/lp';
import { clamp, mapLimit, mean } from '@/core/math';
import type { EntityRow, Feat, LiveGameView, LivePlayer, MatchSummary, MmrView, ProfileView, QueueOutlook, ShownRank } from '@/core/types';
import { getRepo } from '@/server/repo';
import type { PlayerQuery } from '../types';
import { buildBenchmark, lobbyBench, playerValues, potential, radarFor, RADAR, roleMix, tierBench } from './benchmarks';
import { ddragon, type DD } from './ddragon';
import type { LeagueEntryDto, LolSource, MatchDto, ParticipantDto } from './dto';
import { isRemake, metricsFor, noteFor, opponentOf, QUEUES, ROLE_NAMES, scoreFor } from './metrics';
import { fromRating, isApex, LADDER, rankLabel, tierName, TIERS, toRating, type Tier } from './ranks';
import { lolRegion } from './regions';
import { source } from './source';

const MATCHES = Number(process.env.LOL_MATCH_COUNT ?? 20);
/** Lobbies whose ranks we read, and players per lobby. 10 × 5 = 50 calls on a cold cache. */
const LOBBY_MATCHES = Number(process.env.LOL_LOBBY_MATCHES ?? 10);
const LOBBY_PLAYERS = Number(process.env.LOL_LOBBY_PLAYERS ?? 5);

const SOLO = 'RANKED_SOLO_5x5';
const FLEX = 'RANKED_FLEX_SR';

/** Rating for lobby purposes: Solo/Duo first, Flex as a fallback. */
export function ratingOf(entries: LeagueEntryDto[] | null): number | null {
  if (!entries) return null;
  const e = entries.find((x) => x.queueType === SOLO) ?? entries.find((x) => x.queueType === FLEX);
  return e ? toRating(e.tier, e.rank, e.leaguePoints) : null;
}

export const me = (m: MatchDto, puuid: string) => m.info.participants.find((p) => p.puuid === puuid)!;
export const participantName = (p: ParticipantDto) => p.riotIdGameName || p.summonerName || 'Unknown';

/**
 * Read league entries for many players, stopping quietly when the rate limit runs out: a partial
 * lobby sample still produces an estimate, just a less confident one.
 */
export async function readRanks(src: LolSource, region: string, puuids: string[]) {
  const out = new Map<string, number | null>();
  let limited = false;
  await mapLimit([...new Set(puuids)], 8, async (puuid) => {
    if (limited) return;
    try {
      out.set(puuid, ratingOf(await src.league(region, puuid)));
    } catch (e) {
      if (e instanceof RateLimitError) limited = true;
      else out.set(puuid, null);
    }
  });
  return out;
}

/** Lane opponent first, then alternate enemy/ally so both teams are represented. */
function samplePlayers(m: MatchDto, puuid: string, k: number) {
  const self = me(m, puuid);
  const opp = opponentOf(m, self);
  const enemies = m.info.participants.filter((p) => p.teamId !== self.teamId && p !== opp);
  const allies = m.info.participants.filter((p) => p.teamId === self.teamId && p !== self);
  const order = opp ? [opp] : [];
  for (let i = 0; order.length < 9 && i < 5; i++) {
    if (enemies[i]) order.push(enemies[i]);
    if (allies[i]) order.push(allies[i]);
  }
  return order.slice(0, k).map((p) => p.puuid);
}

const ago = (ts: number) => {
  const h = (Date.now() - ts) / 3600_000;
  if (h < 1) return 'Ahora mismo';
  if (h < 24) return `Hace ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Ayer' : `Hace ${d} días`;
};

const ROLE_COLORS: Record<string, string> = { MIDDLE: 'var(--acc)', BOTTOM: 'var(--win)', UTILITY: 'var(--c-violet)', TOP: 'var(--t-gold)', JUNGLE: 'var(--loss)' };
const ENTITY_COLORS = ['var(--acc)', 'var(--win)', 'var(--c-violet)', 'var(--t-gold)', 'var(--loss)', 'var(--t-plat)', 'var(--t-diamond)', 'var(--c-mute)'];

export async function buildProfile(regionId: string, q: PlayerQuery): Promise<ProfileView> {
  const src = source();
  const region = lolRegion(regionId)!;
  const dd = await ddragon();

  const account = await src.account(region.id, q.name, q.tag);
  const puuid = account.puuid;
  const [summoner, league, ids] = await Promise.all([
    src.summoner(region.id, puuid),
    src.league(region.id, puuid),
    src.matchIds(region.id, puuid, MATCHES),
  ]);
  const matches = (await mapLimit(ids, 6, (id) => src.match(region.id, id))).sort((a, b) => (b.info.gameEndTimestamp ?? 0) - (a.info.gameEndTimestamp ?? 0));
  const played = matches.filter((m) => !isRemake(m) && m.info.participants.some((p) => p.puuid === puuid));

  // ---- Rank tracking: real LP of single games between two snapshots
  const history = src.demo ? null : await loadTracking(puuid);

  // ---- Hidden MMR per queue. Solo/Duo and Flex keep separate MMRs, so each is estimated from its
  // own lobbies. The primary queue (Solo/Duo, else Flex) gets the full sample; the other a light one.
  const soloEntry = league.find((e) => e.queueType === SOLO) ?? null;
  const flexEntry = league.find((e) => e.queueType === FLEX) ?? null;
  const primaryEntry = soloEntry ?? flexEntry;
  const primary = await analyseQueue(src, region.id, puuid, played, primaryEntry, primaryEntry?.queueType === FLEX ? 440 : 420, LOBBY_MATCHES, LOBBY_PLAYERS, true, referenceFor(history, primaryEntry?.queueType ?? SOLO));
  const secondaryEntry = primaryEntry === soloEntry ? flexEntry : null;
  const secondary = secondaryEntry ? await analyseQueue(src, region.id, puuid, played, secondaryEntry, 440, 5, 4, false, referenceFor(history, FLEX)) : null;

  const shownRating = primary.shownRating;
  const shown = primary.shown;
  const { est, lobbyOf } = primary;
  const results = played.map((m) => me(m, puuid).win);
  const estRank = rankLabel(est.mean);

  const lobbyRank = est.lobbyMean != null ? rankLabel(est.lobbyMean) : null;
  const diff = shownRating != null ? est.mean - shownRating : 0;
  const verdict: MmrView['verdict'] = !lobbyRank
    ? { before: 'Aún no hay suficientes jugadores con rango en tus partidas; la estimación se apoya en ', highlight: shown ? shown.label : 'tus resultados', color: shown?.color ?? 'var(--tx)', after: '.' }
    : shownRating == null
      ? { before: 'Tus partidas tienen de media ', highlight: lobbyRank.label, color: lobbyRank.color, after: '. Aún no tienes rango visible, así que ellas lo dicen todo.' }
      : diff >= 60
        ? { before: 'Tus partidas tienen de media ', highlight: lobbyRank.label, color: lobbyRank.color, after: '. Probablemente estás por encima de tu rango visible.' }
        : diff <= -60
          ? { before: 'Tus partidas tienen de media ', highlight: lobbyRank.label, color: lobbyRank.color, after: '. Tu rango visible va por delante de tu MMR.' }
          : { before: 'Tus partidas tienen de media ', highlight: lobbyRank.label, color: lobbyRank.color, after: '. Tu rango visible coincide con tu MMR.' };

  const mmr: MmrView = {
    value: Math.round(est.mean),
    lo: Math.round(est.lo80),
    hi: Math.round(est.hi80),
    confidence: est.confidence,
    trend: Math.round(est.trend),
    trendWindow: lobbyOf.size,
    estimated: estRank,
    lobbyAvg: lobbyRank,
    divisionsDelta: shownRating != null ? Math.round(diff / 50) / 2 : null,
    lobbiesRead: lobbyOf.size,
    history: est.history.map(Math.round),
    verdict,
  };

  // ---- Performance vs benchmarks
  const mine = played.map((m) => metricsFor(m, me(m, puuid)));
  const opps = played.map((m) => opponentOf(m, me(m, puuid))).map((o, i) => (o ? metricsFor(played[i], o) : null)).filter((x) => x != null);
  const mix = roleMix(mine);
  const pv = playerValues(mine);
  const estTier = TIERS.indexOf(fromRating(est.mean).tier);
  const shownTier = shownRating != null ? TIERS.indexOf(fromRating(shownRating).tier) : null;
  const benchmarks = [];
  if (shownTier != null) benchmarks.push(buildBenchmark('shown', `Media ${tierName(TIERS[shownTier])}`, tierName(TIERS[shownTier]), true, pv, tierBench(shownTier, mix), mix));
  if (estTier !== shownTier) benchmarks.push(buildBenchmark('est', `Media ${tierName(TIERS[estTier])}`, tierName(TIERS[estTier]), true, pv, tierBench(estTier, mix), mix));
  if (opps.length >= 3) benchmarks.push(buildBenchmark('lobby', 'Tus partidas', 'Rival de calle', false, pv, lobbyBench(opps), mix));

  // ---- Reach
  const pot = potential(pv, estTier, mix);
  const r = reach({ est, shown: shownRating, potential: pot.points, winRate: results.length ? results.filter(Boolean).length / results.length : 0.5 });

  // ---- Feats, champions, roles, matches
  const feats = buildFeats(played, puuid, dd.championName);

  const byChamp = new Map<string, MatchDto[]>();
  for (const m of played) {
    const c = me(m, puuid).championName;
    byChamp.set(c, [...(byChamp.get(c) ?? []), m]);
  }
  const champRows: EntityRow[] = [...byChamp.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([c, ms], i) => {
      const ps = ms.map((m) => me(m, puuid));
      const k = mean(ps.map((p) => p.kills)), d = mean(ps.map((p) => p.deaths)), a = mean(ps.map((p) => p.assists));
      const score = mean(ms.map((m) => scoreFor(m, puuid)));
      return {
        name: dd.championName(c),
        image: dd.championImg(c),
        color: ENTITY_COLORS[i % ENTITY_COLORS.length],
        games: ms.length,
        winRate: Math.round((100 * ps.filter((p) => p.win).length) / ps.length),
        cells: [((k + a) / Math.max(1, d)).toFixed(1), mean(ms.map((m) => metricsFor(m, me(m, puuid)).csPerMin)).toFixed(1)],
        badge: { text: score.toFixed(1), tone: score >= 6 ? 'up' : score < 4.5 ? 'dn' : 'eq' },
      };
    });

  const roleCount = new Map<string, number>();
  for (const m of mine) if (m.role) roleCount.set(m.role, (roleCount.get(m.role) ?? 0) + 1);
  const roleTotal = [...roleCount.values()].reduce((a, b) => a + b, 0) || 1;

  const summaries: MatchSummary[] = matches
    .filter((m) => m.info.participants.some((p) => p.puuid === puuid))
    .map((m) => {
      const p = me(m, puuid);
      const met = metricsFor(m, p);
      const q = m.info.queueId === 440 && secondary ? secondary : primary;
      const obs = lobbyOf.get(m.metadata.matchId) ?? secondary?.lobbyOf.get(m.metadata.matchId);
      const lpDelta = history?.games.find((g) => g.matchId === m.metadata.matchId)?.delta ?? null;
      return {
        id: m.metadata.matchId,
        win: p.win,
        remake: isRemake(m),
        queue: QUEUES[m.info.queueId] ?? 'Clasificatoria',
        title: dd.championName(p.championName),
        image: dd.championImg(p.championName),
        level: p.champLevel,
        durationSec: m.info.gameDuration,
        endedAt: m.info.gameEndTimestamp ?? m.info.gameCreation + m.info.gameDuration * 1000,
        k: p.kills,
        d: p.deaths,
        a: p.assists,
        cs: met.cs,
        csPerMin: Math.round(met.csPerMin * 10) / 10,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].map(dd.itemImg),
        lobby: obs ? rankLabel(obs.value) : null,
        badge: lpDelta != null ? { value: `${lpDelta >= 0 ? '+' : '−'}${Math.abs(lpDelta)}`, unit: 'LP' } : { value: `${Math.round(met.killParticipation * 100)}%`, unit: 'KP' },
        lpDelta,
        mmrDelta: obs ? mmrSwing(q.est.mean, obs.value, p.win) : null,
        score: isRemake(m) ? 0 : scoreFor(m, puuid),
        note: isRemake(m) ? 'Remake: no cuenta.' : noteFor(m, puuid),
      };
    });

  const outlook = [outlookFor(primary, history), ...(secondary ? [outlookFor(secondary, history)] : [])];
  const live = await buildLive(src, region.id, puuid, dd, outlook, est.mean);
  const wins = results.filter(Boolean).length;
  const reachRank = rankLabel(r.target);
  return {
    demo: src.demo,
    ref: { game: 'lol', region: region.id, puuid },
    header: {
      game: 'lol',
      gameName: 'League of Legends',
      region: region.id,
      name: account.gameName.trim(),
      tag: account.tagLine.trim(),
      level: summoner.summonerLevel,
      icon: dd.iconImg(summoner.profileIconId),
      shown,
      recent: { wins, losses: results.length - wins },
      fetchedAt: Date.now(),
    },
    mmr,
    outlook,
    live,
    ladder: LADDER,
    scale: Array.from({ length: 33 }, (_, i) => rankLabel(i * 100)),
    reach: {
      target: Math.round(r.target),
      lo: Math.round(r.lo),
      hi: Math.round(r.hi),
      rank: reachRank,
      rangeLabel: `${rankLabel(r.lo).short} – ${rankLabel(r.hi).short}`,
      probability: r.probability,
      games: r.games,
      heldBackBy: pot.heldBackBy,
    },
    performance: { axes: RADAR.map((a) => a.label), player: radarFor(pv, mix), benchmarks },
    feats,
    entities: { eyebrow: 'Estadísticas de campeones', title: `Más jugados · últimas ${played.length}`, columns: ['KDA', 'CS/min'], badgeColumn: 'Nota media', rows: champRows },
    distribution: {
      eyebrow: 'Reparto de roles',
      title: 'Dónde juegas',
      items: [...roleCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([role, n]) => ({ name: ROLE_NAMES[role] ?? role, games: n, pct: Math.round((100 * n) / roleTotal), color: ROLE_COLORS[role] ?? 'var(--c-mute)' })),
    },
    matches: summaries,
    queues: ['Todas', ...new Set(summaries.map((s) => s.queue))],
  };
}

const LIVE_QUEUES: Record<number, string> = { 420: 'Clasificatoria Solo/Dúo', 440: 'Clasificatoria Flexible', 400: 'Normal (selección)', 430: 'Normal (a ciegas)', 490: 'Partida rápida', 450: 'ARAM', 1700: 'Arena', 1900: 'URF' };

async function buildLive(src: LolSource, region: string, puuid: string, dd: DD, outlook: QueueOutlook[], myMmr: number): Promise<LiveGameView | null> {
  const game = await src.activeGame(region, puuid).catch(() => null);
  if (!game) return null;
  const others = game.participants.map((p) => p.puuid).filter((p): p is string => !!p && p !== puuid);
  const ranks = await readRanks(src, region, others);
  const myTeam = game.participants.find((p) => p.puuid === puuid)?.teamId ?? 100;
  const teams = [myTeam, myTeam === 100 ? 200 : 100].map((teamId) => {
    const ps = game.participants.filter((p) => p.teamId === teamId);
    const players: LivePlayer[] = ps.map((p) => {
      const [name, tag] = (p.riotId ?? 'Oculto#').split('#');
      const champ = dd.championIdOf(p.championId);
      const r = p.puuid && p.puuid !== puuid ? ranks.get(p.puuid) : null;
      return { name, tag: tag ?? '', champion: champ ? dd.championName(champ) : 'Desconocido', image: champ ? dd.championImg(champ) : null, rank: r != null ? rankLabel(r) : null, me: p.puuid === puuid };
    });
    const ratings = ps.map((p) => (p.puuid === puuid ? myMmr : p.puuid ? ranks.get(p.puuid) : null)).filter((v): v is number => v != null);
    return { mine: teamId === myTeam, ratings, avg: ratings.length ? rankLabel(mean(ratings)) : null, players };
  });
  const [mine, theirs] = teams;
  const ranked = game.gameQueueConfigId === 420 || game.gameQueueConfigId === 440;
  const o = outlook.find((x) => x.id === (game.gameQueueConfigId === 440 ? 'flex' : 'solo/duo'));
  return {
    queue: LIVE_QUEUES[game.gameQueueConfigId] ?? 'Personalizada',
    startedAt: game.gameStartTime,
    teams: teams.map(({ mine: m, avg, players }) => ({ mine: m, avg, players })),
    winChance: mine.ratings.length >= 3 && theirs.ratings.length >= 3 ? Math.round(100 * winChance(mean(mine.ratings), mean(theirs.ratings))) : null,
    lp: ranked && o?.nextWin && o.nextLoss ? { win: o.nextWin.lp, loss: o.nextLoss.lp } : null,
  };
}

function shownOf(entry: LeagueEntryDto | null): { rating: number | null; shown: ShownRank | null } {
  if (!entry) return { rating: null, shown: null };
  const rating = toRating(entry.tier, entry.rank, entry.leaguePoints);
  return {
    rating,
    shown: {
      ...rankLabel(rating),
      lp: entry.leaguePoints,
      progress: isApex(entry.tier as Tier) ? clamp(entry.leaguePoints / 1000, 0, 1) : entry.leaguePoints / 100,
      queueLabel: entry.queueType === FLEX ? 'Ranked Flex' : 'Ranked Solo/Duo',
      seasonGames: entry.wins + entry.losses,
    },
  };
}

interface QueueReference {
  win: number;
  loss: number;
  source: 'manual' | 'tracked';
  at: number;
}

/** LP values to anchor a queue on: what the player typed (if recent), else the average of tracked games. */
function referenceFor(history: PlayerHistory | null, queueType: string): QueueReference | null {
  const manual = history?.reference?.[queueType];
  if (manual && Date.now() - manual.at < 14 * 86400_000) return { ...manual, source: 'manual' };
  const games = (history?.games ?? []).filter((g) => g.queueType === queueType && Math.abs(g.delta) >= 5 && Math.abs(g.delta) <= 60).slice(0, 10);
  const wins = games.filter((g) => g.win).map((g) => g.delta);
  const losses = games.filter((g) => !g.win).map((g) => -g.delta);
  if (!wins.length || !losses.length) return null;
  return { win: Math.round(mean(wins)), loss: Math.round(mean(losses)), source: 'tracked', at: games[0].at };
}

type QueueAnalysis = Awaited<ReturnType<typeof analyseQueue>>;

/** Hidden-MMR estimate for one queue from its own lobbies (falls back to all games if too few). */
async function analyseQueue(
  src: LolSource,
  region: string,
  puuid: string,
  played: MatchDto[],
  entry: LeagueEntryDto | null,
  queueId: number,
  lobbies: number,
  players: number,
  allowFallback: boolean,
  reference: QueueReference | null,
) {
  const { rating: shownRating, shown } = shownOf(entry);
  const sameQueue = played.filter((m) => m.info.queueId === queueId);
  const pool = sameQueue.length >= 4 || !allowFallback ? sameQueue : played;
  const sampled = pool.slice(0, lobbies);
  const picks = new Map(sampled.map((m) => [m.metadata.matchId, samplePlayers(m, puuid, players)]));
  const ranks = await readRanks(src, region, [...picks.values()].flat());

  const lobbyOf = new Map<string, LobbyObservation>();
  const diffs: number[] = [];
  for (const m of sampled) {
    const self = me(m, puuid);
    const rated = picks.get(m.metadata.matchId)!.map((p) => ({ p, r: ranks.get(p) })).filter((x): x is { p: string; r: number } => x.r != null);
    if (rated.length >= 2) lobbyOf.set(m.metadata.matchId, { value: mean(rated.map((x) => x.r)), players: rated.length, win: self.win, at: m.info.gameEndTimestamp ?? m.info.gameCreation });
    const team = (p: string) => m.info.participants.find((x) => x.puuid === p)?.teamId;
    const allies = rated.filter((x) => team(x.p) === self.teamId).map((x) => x.r);
    const enemies = rated.filter((x) => team(x.p) !== self.teamId).map((x) => x.r);
    if (allies.length && enemies.length) diffs.push(mean(allies) - mean(enemies));
  }
  const lpImplied = shownRating != null && reference ? shownRating + gapFromLp(reference) : null;
  const anchor = lpImplied != null ? { value: lpImplied, sd: reference!.source === 'manual' ? LP_ANCHOR_SD : LP_ANCHOR_SD + 15 } : null;
  const est = estimate({ shown: shownRating, lobbies: [...lobbyOf.values()], results: pool.map((m) => me(m, puuid).win), anchor });
  return {
    queueId,
    reference,
    lpImplied,
    label: queueId === 440 ? 'Flexible' : 'Solo/Dúo',
    entry,
    shownRating,
    shown,
    est,
    lobbyOf,
    balance: diffs.length >= 3 ? { avgDiff: Math.round(mean(diffs)), weakerTeam: diffs.filter((d) => d < -50).length, games: diffs.length } : null,
  };
}

interface PlayerHistory {
  games: { matchId: string; queueType: string; delta: number; win: boolean; at: number }[];
  reference?: Record<string, { win: number; loss: number; at: number }>;
}

/** Real LP per game (recorded by the tracker) and LP the player typed in, for tracked players. */
async function loadTracking(puuid: string): Promise<PlayerHistory | null> {
  const repo = getRepo();
  if (!(await repo.getPlayer(puuid))) return null;
  const rows = await repo.playerMatches(puuid);
  const notes = await repo.getNotes(puuid);
  const ref = notes.lpReference as { win: number; loss: number; at: number } | undefined;
  return {
    games: rows.filter((r) => r.lpDelta != null).map((r) => ({ matchId: r.matchId, queueType: r.queueId === 440 ? FLEX : SOLO, delta: r.lpDelta!, win: r.win, at: r.endedAt })),
    reference: ref ? { [SOLO]: ref } : undefined,
  };
}

function outlookFor(q: QueueAnalysis, history: PlayerHistory | null): QueueOutlook {
  const tracked = (history?.games ?? []).filter((g) => g.queueType === (q.queueId === 440 ? FLEX : SOLO));
  const gap = q.shownRating != null ? q.est.mean - q.shownRating : null;
  // Riot's own LP asymmetry is the most direct evidence of MMR vs rank: prefer it when we have it.
  const rankGap = q.lpImplied != null && q.shownRating != null ? q.lpImplied - q.shownRating : gap;
  const f = gap != null ? forecastLp(gap, tracked, q.reference) : null;
  const e = q.entry;
  let toNext: QueueOutlook['toNext'] = null;
  let toDemote: QueueOutlook['toDemote'] = null;
  if (e && f && q.shownRating != null && !isApex(e.tier as Tier)) {
    const lp = e.leaguePoints;
    const need = 100 - lp;
    toNext = { lp: need, wins: Math.ceil(need / Math.max(1, f.win.lp)), label: rankLabel(q.shownRating - lp + 100).label };
    const floor = q.shownRating - lp; // rating at 0 LP of this division
    if (floor > 400) toDemote = { losses: Math.floor(lp / Math.max(1, f.loss.lp)) + 1, label: rankLabel(floor - 1).label };
  }
  return {
    id: q.queueId === 440 ? 'flex' : 'solo/duo',
    label: q.label,
    shown: q.shown,
    mmr: Math.round(q.est.mean),
    mmrRank: rankLabel(q.est.mean),
    lo: Math.round(q.est.lo80),
    hi: Math.round(q.est.hi80),
    confidence: q.est.confidence,
    lobbiesRead: q.lobbyOf.size,
    gapLp: rankGap != null ? Math.round(rankGap) : null,
    nextWin: f?.win ?? null,
    nextLoss: f?.loss ?? null,
    calibratedFrom: f?.calibratedFrom ?? 0,
    reference: q.reference,
    lpImpliedMmr: q.lpImplied != null ? Math.round(q.lpImplied) : null,
    toNext,
    toDemote,
    convergeGames: rankGap != null && f ? convergeGames(rankGap, f.win.lp, f.loss.lp) : null,
    winVsRank: q.shownRating != null ? Math.round(100 * winChance(q.est.mean, q.shownRating)) : null,
    season: e ? { wins: e.wins, losses: e.losses } : null,
    balance: q.balance,
    tracked: tracked.slice(0, 12).map(({ matchId, delta, win, at }) => ({ matchId, delta, win, at })),
  };
}

function buildFeats(played: MatchDto[], puuid: string, champName: (id: string) => string): Feat[] {
  const feats: (Feat & { weight: number })[] = [];
  const rows = played.map((m) => ({ m, p: me(m, puuid), met: metricsFor(m, me(m, puuid)), at: m.info.gameEndTimestamp ?? m.info.gameCreation }));
  const when = (ts: number) => ago(ts);

  const penta = rows.find((r) => r.p.pentaKills > 0);
  if (penta) feats.push({ weight: 100, title: 'Pentakill', sub: `${champName(penta.p.championName)} · los cinco en una pelea`, when: when(penta.at), mark: '5×', color: 'var(--acc)' });
  else {
    const quadra = rows.find((r) => r.p.quadraKills > 0);
    if (quadra) feats.push({ weight: 70, title: 'Quadrakill', sub: `${champName(quadra.p.championName)} · cuatro en una pelea`, when: when(quadra.at), mark: '4×', color: 'var(--acc)' });
  }

  let streak = 0;
  for (const r of rows) {
    if (!r.p.win) break;
    streak++;
  }
  let longest = 0;
  let run = 0;
  for (const r of rows) {
    run = r.p.win ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  if (streak >= 3) feats.push({ weight: 60 + streak, title: 'Racha de victorias', sub: `${streak} victorias seguidas en ranked`, when: 'En curso', mark: `${streak}V`, color: 'var(--t-gold)' });
  else if (longest >= 4) feats.push({ weight: 40 + longest, title: 'Racha de victorias', sub: `${longest} victorias seguidas en ranked`, when: `Últimas ${rows.length} partidas`, mark: `${longest}V`, color: 'var(--t-gold)' });

  const perfect = rows.filter((r) => r.p.deaths === 0 && r.p.win).sort((a, b) => b.p.kills + b.p.assists - (a.p.kills + a.p.assists))[0];
  if (perfect) feats.push({ weight: 65, title: 'Partida perfecta', sub: `${perfect.p.kills} / 0 / ${perfect.p.assists} con ${champName(perfect.p.championName)}`, when: when(perfect.at), mark: 'PERF', color: 'var(--c-violet)' });
  else {
    const best = [...rows].sort((a, b) => b.met.kda - a.met.kda)[0];
    if (best && best.met.kda >= 4)
      feats.push({ weight: 45, title: 'Mejor KDA', sub: `${best.p.kills} / ${best.p.deaths} / ${best.p.assists} con ${champName(best.p.championName)}`, when: when(best.at), mark: best.met.kda.toFixed(1), color: 'var(--c-violet)' });
  }

  const steal = rows.find((r) => (r.p.challenges?.epicMonsterSteals ?? 0) > 0);
  if (steal) feats.push({ weight: 55, title: 'Robo de objetivo', sub: `Robaste un monstruo épico con ${champName(steal.p.championName)}`, when: when(steal.at), mark: 'STL', color: 'var(--loss)' });

  const carry = [...rows].sort((a, b) => b.met.damageShare - a.met.damageShare)[0];
  if (carry && carry.met.damageShare >= 0.3)
    feats.push({ weight: 40, title: 'Partida de carry', sub: `${Math.round(carry.met.damageShare * 100)}% del daño del equipo con ${champName(carry.p.championName)}`, when: when(carry.at), mark: `${Math.round(carry.met.damageShare * 100)}%`, color: 'var(--win)' });

  const vision = [...rows].sort((a, b) => b.met.visionPerMin - a.met.visionPerMin)[0];
  if (vision && vision.met.visionPerMin >= 1.8)
    feats.push({ weight: 30, title: 'Control del mapa', sub: `${vision.met.visionPerMin.toFixed(1)} de visión/min con ${champName(vision.p.championName)}`, when: when(vision.at), mark: 'VIS', color: 'var(--t-plat)' });

  const solo = [...rows].sort((a, b) => (b.p.challenges?.soloKills ?? 0) - (a.p.challenges?.soloKills ?? 0))[0];
  if (solo && (solo.p.challenges?.soloKills ?? 0) >= 3)
    feats.push({ weight: 35, title: 'Duelista', sub: `${solo.p.challenges!.soloKills} solo kills con ${champName(solo.p.championName)}`, when: when(solo.at), mark: `${solo.p.challenges!.soloKills}SK`, color: 'var(--t-gold)' });

  return feats
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((f) => ({ title: f.title, sub: f.sub, when: f.when, mark: f.mark, color: f.color }));
}
