import 'server-only';
import { PlayerNotFoundError } from '@/core/errors';
import { mean } from '@/core/math';
import type { DetailTeam, MatchDetailView } from '@/core/types';
import type { PlayerQuery } from '../types';
import { ddragon } from './ddragon';
import type { MatchDto, TimelineDto } from './dto';
import { analyse, baselineOf } from './analysis';
import { breakdown, CATEGORY_ES, metricsFor, ROLE_NAMES, scoreFor } from './metrics';
import { mapLimit } from '@/core/math';
import { me, participantName, readRanks } from './profile';
import { rankLabel } from './ranks';
import { lolRegion } from './regions';
import { source } from './source';

export async function buildMatch(regionId: string, matchId: string, q: PlayerQuery): Promise<MatchDetailView> {
  const src = source();
  const region = lolRegion(regionId)!;
  const dd = await ddragon();
  const { puuid } = await src.account(region.id, q.name, q.tag);
  const [m, tl] = await Promise.all([src.match(region.id, matchId), src.timeline(region.id, matchId).catch(() => null)]);
  if (!m.info.participants.some((p) => p.puuid === puuid)) throw new PlayerNotFoundError(`${q.name}#${q.tag} en ${matchId}`);
  const ranks = await readRanks(src, region.id, m.info.participants.map((p) => p.puuid));
  const self = me(m, puuid);
  const myTeam = self.teamId;
  const met = metricsFor(m, self);

  const scores = new Map(m.info.participants.map((p) => [p.puuid, scoreFor(m, p.puuid)]));
  const place = [...scores.values()].sort((a, b) => b - a).indexOf(scores.get(puuid)!) + 1;

  const avgRank = (puuids: string[]) => {
    const xs = puuids.map((p) => ranks.get(p)).filter((v): v is number => v != null);
    return xs.length ? rankLabel(mean(xs)) : null;
  };

  const teamIds = [myTeam, myTeam === 100 ? 200 : 100];
  const teams: DetailTeam[] = teamIds.map((teamId) => {
    const ps = m.info.participants.filter((p) => p.teamId === teamId);
    const t = m.info.teams.find((x) => x.teamId === teamId)!;
    const o = t.objectives;
    const n = (k: number | undefined, one: string, many: string) => `${k ?? 0} ${(k ?? 0) === 1 ? one : many}`;
    const obj = [n(o.tower?.kills, 'torre', 'torres'), n(o.dragon?.kills, 'dragón', 'dragones'), o.baron?.kills ? n(o.baron.kills, 'Barón', 'Barones') : null].filter(Boolean).join(' · ');
    return {
      name: `Equipo ${teamId === 100 ? 'azul' : 'rojo'} · ${t.win ? 'Victoria' : 'Derrota'}`,
      win: t.win,
      kills: ps.reduce((s, p) => s + p.kills, 0),
      gold: ps.reduce((s, p) => s + p.goldEarned, 0),
      objectives: obj,
      avgRank: avgRank(ps.map((p) => p.puuid)),
      players: ps.map((p) => {
        const r = ranks.get(p.puuid);
        return {
          name: participantName(p),
          tag: p.riotIdTagline ?? '',
          champion: dd.championName(p.championName),
          image: dd.championImg(p.championName),
          rank: r != null ? rankLabel(r) : null,
          k: p.kills,
          d: p.deaths,
          a: p.assists,
          damage: p.totalDamageDealtToChampions,
          gold: p.goldEarned,
          cs: p.totalMinionsKilled + p.neutralMinionsKilled,
          vision: p.visionScore,
          items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map(dd.itemImg),
          score: scores.get(p.puuid)!,
          me: p.puuid === puuid,
        };
      }),
    };
  });

  // Personal baseline: the player's other recent ranked games (cached, so usually free).
  const recentIds = (await src.matchIds(region.id, puuid, 20).catch(() => [] as string[])).filter((id) => id !== matchId);
  const recent = await mapLimit(recentIds, 6, (id) => src.match(region.id, id).catch(() => null));
  const analysis = analyse(m, tl, puuid, dd, baselineOf(recent.filter((x): x is MatchDto => !!x), puuid));
  const b = breakdown(m, puuid);
  const { gold, damage, events } = timelineSeries(m, tl, myTeam);
  return {
    demo: src.demo,
    id: matchId,
    queue: m.info.queueId === 440 ? 'Clasificatoria Flexible' : 'Clasificatoria Solo/Dúo',
    durationSec: m.info.gameDuration,
    endedAt: m.info.gameEndTimestamp ?? m.info.gameCreation + m.info.gameDuration * 1000,
    me: { name: participantName(self), tag: self.riotIdTagline ?? '', puuid },
    win: self.win,
    champion: dd.championName(self.championName),
    image: dd.championImg(self.championName),
    role: ROLE_NAMES[self.teamPosition] ?? '',
    k: self.kills,
    d: self.deaths,
    a: self.assists,
    killParticipation: Math.round(met.killParticipation * 100),
    cs: met.cs,
    score: scores.get(puuid)!,
    scoreNote: place === 1 ? 'El mejor de la partida' : `#${place} de 10 en la partida`,
    lobby: [
      { label: 'Media de tu equipo', rank: teams[0].avgRank },
      { label: 'Media de la partida', rank: avgRank(m.info.participants.map((p) => p.puuid)) },
      { label: 'Media del equipo rival', rank: teams[1].avgRank },
    ],
    teams,
    gold,
    damage,
    events,
    breakdown: Object.entries(b).map(([label, value]) => ({ label: CATEGORY_ES[label] ?? label, value, avg: 5 })),
    analysis,
  };
}

function timelineSeries(m: MatchDto, tl: TimelineDto | null, myTeam: number) {
  if (!tl) return { gold: [], damage: { mine: [], theirs: [] }, events: [] as MatchDetailView['events'] };
  // participantId (1–10) → teamId, via the timeline's own participant order.
  const teamOf = (id: number) => m.info.participants.find((p) => p.puuid === tl.metadata.participants[id - 1])?.teamId ?? 0;
  const gold: number[] = [];
  const mine: number[] = [];
  const theirs: number[] = [];
  for (const f of tl.info.frames) {
    let g = 0, dm = 0, dt = 0;
    for (const [id, pf] of Object.entries(f.participantFrames)) {
      const own = teamOf(Number(id)) === myTeam;
      g += own ? pf.totalGold : -pf.totalGold;
      if (own) dm += pf.damageStats?.totalDamageDoneToChampions ?? 0;
      else dt += pf.damageStats?.totalDamageDoneToChampions ?? 0;
    }
    gold.push(g);
    mine.push(dm);
    theirs.push(dt);
  }

  const events: MatchDetailView['events'] = [];
  let firstTower = false;
  for (const f of tl.info.frames)
    for (const e of f.events) {
      const minute = e.timestamp / 60_000;
      const team = e.killerTeamId ?? (e.killerId ? teamOf(e.killerId) : 0);
      if (e.type === 'CHAMPION_SPECIAL_KILL' && e.killType === 'KILL_FIRST_BLOOD') events.push({ minute, label: 'Primera sangre', good: team === myTeam });
      else if (e.type === 'CHAMPION_SPECIAL_KILL' && e.killType === 'KILL_ACE') events.push({ minute, label: 'Ace', good: team === myTeam });
      else if (e.type === 'ELITE_MONSTER_KILL') {
        const label = e.monsterType === 'DRAGON' ? 'Dragón' : e.monsterType === 'BARON_NASHOR' ? 'Barón' : e.monsterType === 'RIFTHERALD' ? 'Heraldo' : e.monsterType === 'ATAKHAN' ? 'Atakhan' : null;
        if (label) events.push({ minute, label, good: team === myTeam });
      } else if (e.type === 'BUILDING_KILL' && e.buildingType === 'TOWER_BUILDING' && !firstTower) {
        firstTower = true;
        // BUILDING_KILL.teamId is the team that lost the tower.
        events.push({ minute, label: 'Primera torre', good: e.teamId !== myTeam });
      }
    }
  const won = m.info.teams.find((t) => t.teamId === myTeam)?.win ?? false;
  events.push({ minute: m.info.gameDuration / 60, label: 'Nexus', good: won });
  // Keep the timeline readable: at most 10 moments, always keeping the first and last.
  while (events.length > 10) {
    const i = events.findIndex((e, k) => k > 0 && k < events.length - 1 && e.label === 'Dragón');
    events.splice(i > 0 ? i : 1, 1);
  }
  return { gold, damage: { mine, theirs }, events };
}
