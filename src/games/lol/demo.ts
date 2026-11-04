import { PlayerNotFoundError, RateLimitError } from '@/core/errors';
import { clamp, rng, type Rng } from '@/core/math';
import type { AccountDto, LeagueEntryDto, LolSource, MatchDto, ParticipantDto, TeamDto, TimelineDto, TimelineEventDto } from './dto';
import { fromRating } from './ranks';

/**
 * Deterministic synthetic data shaped exactly like Riot's DTOs, used when RIOT_API_KEY is not set.
 * The same search always yields the same player. Search "404#EUW" or "429#EUW" to see error states.
 */

const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
const CHAMPS: Record<(typeof POSITIONS)[number], string[]> = {
  TOP: ['Garen', 'Darius', 'Camille', 'Gnar', 'Fiora', 'Ornn', 'Jax', 'Aatrox', 'Renekton', 'Sett'],
  JUNGLE: ['LeeSin', 'Viego', 'Vi', 'Kayn', 'Graves', 'Hecarim', 'Elise', 'JarvanIV', 'Khazix', 'Amumu'],
  MIDDLE: ['Ahri', 'Orianna', 'Syndra', 'Viktor', 'Yasuo', 'Akali', 'Sylas', 'Annie', 'Zed', 'Lux'],
  BOTTOM: ['Jinx', 'Kaisa', 'Ezreal', 'Caitlyn', 'Ashe', 'Jhin', 'MissFortune', 'Vayne', 'Xayah', 'Lucian'],
  UTILITY: ['Nautilus', 'Lulu', 'Thresh', 'Leona', 'Nami', 'Karma', 'Rakan', 'Blitzcrank', 'Milio', 'Soraka'],
};
const ITEMS = [3031, 3153, 3006, 3089, 3157, 6655, 3020, 3036, 3071, 3074, 6672, 3046, 3094, 3135, 3165, 3190, 3107, 3047, 3111, 3078, 6653, 4645, 3065, 3742];
const SYL = ['night', 'lark', 'hex', 'cat', 'rook', 'well', 'blue', 'fin', 'or', 'sol', 'ya', 'van', 'ta', 'black', 'kes', 'trel', 'mar', 'row', 'ju', 'no', 'tide', 'pool', 'vex', 'ash', 'lumen', 'ki', 'ro', 'zen'];

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString();

const mainPuuid = (key: string) => `demo~${b64(key)}`;
const keyOf = (puuid: string) => unb64(puuid.split('~')[1] ?? '');

/** Hidden "true" MMR and visible rating of a searched demo player. */
function persona(key: string) {
  const r = rng(`persona:${key}`);
  const shown = Math.round(r.range(700, 3050));
  const mmr = shown + r.normal(90, 140);
  const mainRole = r.pick(POSITIONS);
  return { shown, mmr, mainRole, level: r.int(60, 640), icon: r.int(0, 28), seasonGames: r.int(60, 320) };
}

const lobbyRating = (key: string, idx: number) => persona(key).mmr + rng(`lobby:${key}:${idx}`).normal(0, 85);
const ANCHOR = Math.floor(Date.now() / 3600_000) * 3600_000;

function name(r: Rng) {
  const n = r.pick(SYL) + r.pick(SYL) + (r.chance(0.3) ? r.int(1, 99) : '');
  return r.chance(0.5) ? n[0].toUpperCase() + n.slice(1) : n;
}

function buildMatch(key: string, idx: number): MatchDto {
  const p = persona(key);
  const r = rng(`match:${key}:${idx}`);
  const lobby = lobbyRating(key, idx);
  const myTeam = r.chance(0.5) ? 100 : 200;
  const myRole = r.chance(0.72) ? p.mainRole : r.pick(POSITIONS);
  const edge = (p.mmr - lobby) / 900;
  const win = r.chance(clamp(0.5 + edge, 0.2, 0.8));
  const duration = Math.round(r.range(21, 38) * 60);
  const minutes = duration / 60;
  const tierScale = 0.8 + 0.25 * clamp(lobby / 2800, 0, 1.4);
  const ended = ANCHOR - idx * Math.round(r.range(2, 20) * 3600_000) - r.int(0, 3600_000);

  const winner = win ? myTeam : myTeam === 100 ? 200 : 100;
  const participants: ParticipantDto[] = [];
  for (const teamId of [100, 200]) {
    const teamWin = teamId === winner;
    const teamKills = Math.round(minutes * r.range(0.6, 0.95) * (teamWin ? 1.15 : 0.8));
    const shares = POSITIONS.map((pos) => ({ TOP: 0.2, JUNGLE: 0.22, MIDDLE: 0.25, BOTTOM: 0.27, UTILITY: 0.06 })[pos] * r.range(0.5, 1.6));
    const shareSum = shares.reduce((a, b) => a + b, 0);
    POSITIONS.forEach((pos, i) => {
      const me = teamId === myTeam && pos === myRole;
      const z = r.normal(0, 0.8) + (teamWin ? 0.3 : -0.3) + (me ? edge * 2.2 + 0.15 : 0);
      const csBase = { TOP: 6.8, JUNGLE: 5.9, MIDDLE: 7.1, BOTTOM: 7.5, UTILITY: 1.1 }[pos];
      const csm = Math.max(0.3, csBase * tierScale + z * (pos === 'UTILITY' ? 0.2 : 0.55));
      const cs = Math.round(csm * minutes);
      const jungle = pos === 'JUNGLE';
      const kills = Math.max(0, Math.round(teamKills * (shares[i] / shareSum) + z * 1.3));
      const deaths = Math.max(0, Math.round(r.range(2, 8) * (teamWin ? 0.75 : 1.15) - z * 1.2));
      const assists = Math.max(0, Math.round(teamKills * r.range(0.25, 0.65) * (pos === 'UTILITY' || jungle ? 1.3 : 1) + z));
      const gpm = { TOP: 400, JUNGLE: 380, MIDDLE: 410, BOTTOM: 420, UTILITY: 270 }[pos] + z * 28 + (teamWin ? 25 : -10);
      const dpm = { TOP: 640, JUNGLE: 520, MIDDLE: 800, BOTTOM: 820, UTILITY: 320 }[pos] * (1 + z * 0.16) * tierScale;
      const vpm = { TOP: 0.75, JUNGLE: 1.05, MIDDLE: 0.8, BOTTOM: 0.75, UTILITY: 2.1 }[pos] * tierScale + z * 0.08 + (me ? -0.12 : 0);
      const pr = rng(`player:${key}:${idx}:${teamId}:${pos}`);
      const multi = me && r.chance(0.035) ? 5 : me && r.chance(0.07) ? 4 : r.chance(0.25) ? 3 : r.chance(0.5) ? 2 : 1;
      const items = Array.from({ length: 6 }, () => (r.chance(0.88) ? r.pick(ITEMS) : 0));
      participants.push({
        puuid: me ? mainPuuid(key) : `demo~${b64(key)}~${idx}~${teamId}${pos}`,
        riotIdGameName: me ? key.split('#')[0].split(':')[1] : name(pr),
        riotIdTagline: me ? key.split('#')[1] : pr.pick(['EUW', 'EUNE', '1337', 'GG', 'NA1', '777']),
        championName: r.pick(CHAMPS[pos]),
        champLevel: clamp(Math.round(minutes * 0.55 + z), 6, 18),
        teamId,
        teamPosition: pos,
        win: teamWin,
        kills,
        deaths,
        assists,
        totalMinionsKilled: jungle ? Math.round(cs * 0.25) : cs,
        neutralMinionsKilled: jungle ? Math.round(cs * 0.75) : r.int(0, 8),
        goldEarned: Math.round(gpm * minutes),
        totalDamageDealtToChampions: Math.round(dpm * minutes),
        damageDealtToObjectives: Math.round((jungle ? 24000 : pos === 'UTILITY' ? 3000 : 9000) * r.range(0.5, 1.5) * (teamWin ? 1.3 : 0.7)),
        visionScore: Math.max(3, Math.round(vpm * minutes)),
        item0: items[0], item1: items[1], item2: items[2], item3: items[3], item4: items[4], item5: items[5],
        item6: pos === 'UTILITY' ? 3364 : 3340,
        largestMultiKill: Math.min(multi, Math.max(1, kills)),
        pentaKills: multi === 5 && kills >= 5 ? 1 : 0,
        quadraKills: multi >= 4 && kills >= 4 ? 1 : 0,
        firstBloodKill: false,
        challenges: {
          laneMinionsFirst10Minutes: jungle ? 0 : Math.max(0, Math.round(csm * 10 * 0.85 + z * 4)),
          jungleCsBefore10Minutes: jungle ? Math.max(20, Math.round(52 + z * 6)) : 0,
          soloKills: Math.max(0, Math.round(r.range(0, 2.5) + z)),
          epicMonsterSteals: me && r.chance(0.05) ? 1 : 0,
        },
      });
    });
  }

  // Team objectives, then per-player takedowns derived from them.
  const teams: TeamDto[] = [100, 200].map((teamId) => {
    const w = teamId === winner;
    const dragons = w ? r.int(2, 4) : r.int(0, 2);
    return {
      teamId,
      win: w,
      objectives: {
        baron: { first: w, kills: w ? r.int(0, 2) : 0 },
        champion: { first: false, kills: participants.filter((x) => x.teamId === teamId).reduce((s, x) => s + x.kills, 0) },
        dragon: { first: w, kills: dragons },
        riftHerald: { first: false, kills: r.int(0, 1) },
        horde: { first: false, kills: r.int(0, 6) },
        tower: { first: w, kills: w ? r.int(6, 10) : r.int(0, 4) },
        inhibitor: { first: w, kills: w ? r.int(1, 3) : 0 },
      },
    };
  });
  for (const x of participants) {
    const t = teams.find((tt) => tt.teamId === x.teamId)!.objectives;
    const presence = x.teamPosition === 'JUNGLE' ? 0.92 : x.teamPosition === 'TOP' ? 0.45 : 0.68;
    const take = (n: number) => Array.from({ length: n }, () => r.chance(presence)).filter(Boolean).length;
    x.challenges!.dragonTakedowns = take(t.dragon?.kills ?? 0);
    x.challenges!.baronTakedowns = take(t.baron?.kills ?? 0);
    x.challenges!.riftHeraldTakedowns = take(t.riftHerald?.kills ?? 0);
  }
  const fb = r.pick(participants.filter((x) => x.kills > 0));
  if (fb) fb.firstBloodKill = true;

  const matchId = `DEMO~${b64(key)}~${idx}`;
  return {
    metadata: { matchId, participants: participants.map((x) => x.puuid) },
    info: { gameCreation: ended - duration * 1000, gameDuration: duration, gameEndTimestamp: ended, queueId: r.chance(0.82) ? 420 : 440, participants, teams },
  };
}

function buildTimeline(key: string, idx: number): TimelineDto {
  const m = buildMatch(key, idx);
  const r = rng(`timeline:${key}:${idx}`);
  const mins = Math.floor(m.info.gameDuration / 60);
  const ps = m.info.participants;
  const winner = m.info.teams.find((t) => t.win)!.teamId;
  const comeback = r.chance(0.22);
  const frames: TimelineDto['info']['frames'] = [];
  const evs: TimelineEventDto[] = [];
  const at = (min: number) => Math.round(min * 60_000);
  const loserTeam = winner === 100 ? 200 : 100;

  evs.push({ type: 'CHAMPION_SPECIAL_KILL', killType: 'KILL_FIRST_BLOOD', timestamp: at(r.range(2.2, 5)), killerId: ps.findIndex((p) => p.firstBloodKill) + 1 || 1 });
  const t = (id: number) => m.info.teams.find((x) => x.teamId === id)!.objectives;
  const sched = (team: number, n: number, kind: string, from: number, to: number, extra: Partial<TimelineEventDto>) => {
    for (let i = 0; i < n; i++) evs.push({ type: kind, timestamp: at(r.range(from, Math.min(to, mins - 0.5))), killerTeamId: team, ...extra });
  };
  for (const team of [100, 200]) {
    sched(team, t(team).dragon?.kills ?? 0, 'ELITE_MONSTER_KILL', 5, mins, { monsterType: 'DRAGON' });
    sched(team, t(team).riftHerald?.kills ?? 0, 'ELITE_MONSTER_KILL', 8, 14, { monsterType: 'RIFTHERALD' });
    sched(team, t(team).baron?.kills ?? 0, 'ELITE_MONSTER_KILL', 20, mins, { monsterType: 'BARON_NASHOR' });
  }
  evs.push({ type: 'BUILDING_KILL', buildingType: 'TOWER_BUILDING', timestamp: at(r.range(9, 15)), teamId: comeback ? winner : loserTeam, killerTeamId: comeback ? loserTeam : winner });
  if (mins > 25) evs.push({ type: 'CHAMPION_SPECIAL_KILL', killType: 'KILL_ACE', timestamp: at(mins - r.range(1.5, 4)), killerTeamId: winner });
  evs.sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i <= mins; i++) {
    const f = i / mins;
    const lead = comeback ? -Math.sin(f * Math.PI * 0.9) * 0.08 + f * f * 0.12 : f * 0.1;
    const pf: TimelineDto['info']['frames'][number]['participantFrames'] = {};
    ps.forEach((p, k) => {
      const side = p.teamId === winner ? 1 + lead : 1 - lead;
      const curve = 500 + (p.goldEarned - 500) * Math.pow(f, 1.08) * side * (1 + r.normal(0, 0.015));
      const lane = { TOP: [1800, 12500], JUNGLE: [4000, 8000], MIDDLE: [7400, 7400], BOTTOM: [12500, 1800], UTILITY: [12200, 2200] }[p.teamPosition as 'TOP'] ?? [7400, 7400];
      const flip = p.teamId === 200 && i < 3 ? 600 : 0;
      pf[String(k + 1)] = {
        totalGold: Math.round(curve),
        currentGold: Math.round(r.range(0, 1400)),
        xp: Math.round(280 * i * (1 + r.normal(0, 0.03))),
        level: Math.min(18, 1 + Math.floor(i / 1.8)),
        minionsKilled: Math.round(p.totalMinionsKilled * f),
        jungleMinionsKilled: Math.round(p.neutralMinionsKilled * f),
        position: { x: lane[0] + flip + r.int(-900, 900), y: lane[1] + flip + r.int(-900, 900) },
        damageStats: {
          totalDamageDoneToChampions: Math.round(p.totalDamageDealtToChampions * Math.pow(f, 1.35) * (1 + r.normal(0, 0.02))),
          totalDamageTaken: Math.round(p.totalDamageDealtToChampions * 1.1 * Math.pow(f, 1.3)),
        },
      };
    });
    frames.push({ timestamp: at(i), participantFrames: pf, events: evs.filter((e) => e.timestamp >= at(i) && e.timestamp < at(i + 1)) });
  }
  return { metadata: { participants: m.metadata.participants }, info: { frames } };
}

function entry(rating: number, queueType: string, games: number, r: Rng): LeagueEntryDto {
  const { tier, division, lp } = fromRating(rating);
  const wins = Math.round(games * clamp(r.normal(0.51, 0.03), 0.4, 0.65));
  return { queueType, tier, rank: division ?? 'I', leaguePoints: lp, wins, losses: games - wins };
}

export const demoSource: LolSource = {
  demo: true,
  async account(region, gameName, tag): Promise<AccountDto> {
    if (gameName === '404') throw new PlayerNotFoundError(`${gameName}#${tag}`);
    if (gameName === '429') throw new RateLimitError(42);
    const key = `${region.toLowerCase()}:${gameName}#${tag}`;
    return { puuid: mainPuuid(key), gameName, tagLine: tag };
  },
  async summoner(_region, puuid) {
    const p = persona(keyOf(puuid));
    return { puuid, profileIconId: p.icon, summonerLevel: p.level };
  },
  async league(_region, puuid) {
    const parts = puuid.split('~');
    const key = keyOf(puuid);
    if (parts.length === 2) {
      const p = persona(key);
      return [entry(p.shown, 'RANKED_SOLO_5x5', p.seasonGames, rng(`entry:${key}`))];
    }
    const r = rng(`lobbyplayer:${puuid}`);
    if (r.chance(0.08)) return [];
    return [entry(lobbyRating(key, Number(parts[2])) + r.normal(0, 210), 'RANKED_SOLO_5x5', r.int(20, 400), r)];
  },
  async matchIds(_region, puuid, count) {
    const k = puuid.split('~')[1];
    return Array.from({ length: count }, (_, i) => `DEMO~${k}~${i}`);
  },
  async match(_region, id) {
    const [, k, idx] = id.split('~');
    return buildMatch(unb64(k), Number(idx));
  },
  // Demo players are never in a live game.
  activeGame: async () => null,
  async timeline(_region, id) {
    const [, k, idx] = id.split('~');
    return buildTimeline(unb64(k), Number(idx));
  },
};
