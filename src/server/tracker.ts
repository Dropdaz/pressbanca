import 'server-only';
import { RateLimitError } from '@/core/errors';
import type { MatchDto } from '@/games/lol/dto';
import { isRemake, metricsFor, scoreFor } from '@/games/lol/metrics';
import { rankLabel, toRating } from '@/games/lol/ranks';
import { freshLeague, riotSource, soloQueueIds } from '@/games/lol/riot';
import { persistentSource } from './persistent';
import { getRepo, seasonOf, type MatchSummaryRow, type TrackedPlayer } from './repo';

const SOLO = 'RANKED_SOLO_5x5';
/** Matches fetched per sync for the season import; keeps a sync well inside 100 calls / 2 min. */
const BACKFILL_PER_SYNC = Number(process.env.BACKFILL_PER_SYNC ?? 30);
/** Old summaries recomputed per sync (see step 0). */
const UPGRADE_PER_SYNC = 120;

export const slugOf = (name: string, tag: string) => `${name}-${tag}`.toLowerCase().replace(/\s+/g, '_');

export function summarize(m: MatchDto, puuid: string): MatchSummaryRow | null {
  const p = m.info.participants.find((x) => x.puuid === puuid);
  if (!p) return null;
  const met = metricsFor(m, p);
  const opp = m.info.participants.find((o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition && !!p.teamPosition);
  const scores = isRemake(m) ? [] : m.info.participants.map((x) => ({ team: x.teamId, s: x.puuid === puuid ? -1 : scoreFor(m, x.puuid) }));
  const mine = isRemake(m) ? 0 : scoreFor(m, puuid);
  return {
    matchId: m.metadata.matchId,
    season: seasonOf(m),
    queueId: m.info.queueId,
    endedAt: m.info.gameEndTimestamp ?? m.info.gameCreation + m.info.gameDuration * 1000,
    durationSec: m.info.gameDuration,
    win: p.win,
    remake: isRemake(m),
    champion: p.championName,
    role: p.teamPosition,
    k: p.kills,
    d: p.deaths,
    a: p.assists,
    cs: met.cs,
    cs10: Math.round((p.challenges?.laneMinionsFirst10Minutes ?? 0) + (p.challenges?.jungleCsBefore10Minutes ?? 0)),
    gold: p.goldEarned,
    damage: p.totalDamageDealtToChampions,
    damageShare: met.damageShare,
    killParticipation: met.killParticipation,
    visionScore: p.visionScore,
    controlWards: Number((p as unknown as { detectorWardsPlaced?: number }).detectorWardsPlaced ?? 0),
    score: mine,
    place: isRemake(m) ? undefined : 1 + scores.filter((x) => x.s > mine).length,
    teamPlace: isRemake(m) ? undefined : 1 + scores.filter((x) => x.team === p.teamId && x.s > mine).length,
    opponent: opp?.championName ?? null,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    lpDelta: null,
  };
}

export interface SyncResult {
  newMatches: string[];
  backfill: { done: boolean; stored: number };
  rank: { label: string; lp: number } | null;
  limited: boolean;
}

const running = new Map<string, Promise<SyncResult>>();

/** Sync one player; concurrent calls for the same player share the same run. */
export function syncPlayer(puuid: string): Promise<SyncResult> {
  const r = running.get(puuid);
  if (r) return r;
  const p = doSync(puuid).finally(() => running.delete(puuid));
  running.set(puuid, p);
  return p;
}

async function doSync(puuid: string): Promise<SyncResult> {
  const repo = getRepo();
  const player = await repo.getPlayer(puuid);
  if (!player) throw new Error('Player is not tracked');
  const src = persistentSource();
  const result: SyncResult = { newMatches: [], backfill: { done: player.backfillDone, stored: 0 }, rank: null, limited: false };
  const stored = await repo.playerMatches(puuid);
  const known = new Set(stored.map((r) => r.matchId));

  // 0) Upgrade old summaries (no lobby placement yet) from stored matches: database only, no Riot calls.
  for (const old of stored.filter((r) => r.place === undefined && !r.remake).slice(0, UPGRADE_PER_SYNC)) {
    const m = await repo.getMatch(old.matchId);
    const row = m ? summarize(m, puuid) : null;
    if (row) await repo.putPlayerMatch(puuid, { ...row, lpDelta: old.lpDelta });
  }

  try {
    // 1) Rank snapshot (always fresh for tracked players).
    const league = await freshLeague(player.region, puuid);
    await repo.putLeague(puuid, league);
    const solo = league.find((e) => e.queueType === SOLO) ?? null;
    const snaps = (await repo.snapshots(puuid)).filter((s) => s.queueType === SOLO);
    const prev = snaps.at(-1) ?? null;
    const rating = solo ? toRating(solo.tier, solo.rank, solo.leaguePoints) : null;
    if (solo && rating != null) {
      result.rank = { label: rankLabel(rating).label, lp: solo.leaguePoints };
      // A drop in games played means the ranked season was reset.
      const changed = !prev || prev.rating !== rating || prev.wins + prev.losses !== solo.wins + solo.losses;
      if (changed) await repo.addSnapshot(puuid, { queueType: SOLO, rating, tier: solo.tier, division: solo.rank, lp: solo.leaguePoints, wins: solo.wins, losses: solo.losses, takenAt: Date.now() });
    }

    // 2) New games since the last sync (newest page).
    const latest = await soloQueueIds(player.region, puuid, 0, 20);
    const fresh = latest.filter((id) => !known.has(id));
    for (const id of fresh.reverse()) {
      const m = await src.match(player.region, id);
      const row = summarize(m, puuid);
      if (!row) continue;
      await repo.putPlayerMatch(puuid, row);
      known.add(id);
      result.newMatches.push(id);
      // Games played after tracking started get their timeline right away (post-game analysis).
      if (row.endedAt > player.addedAt - 3600_000) await src.timeline(player.region, id).catch(() => null);
    }

    // 3) Real LP: exactly one Solo/Duo game between two snapshots → that game's LP.
    if (solo && prev && rating != null) {
      const played = solo.wins + solo.losses - (prev.wins + prev.losses);
      if (played === 1) {
        const rows = (await repo.playerMatches(puuid)).filter((r) => r.queueId === 420 && r.endedAt > prev.takenAt - 10 * 60_000);
        if (rows.length === 1 && rows[0].lpDelta == null) await repo.setLpDelta(puuid, rows[0].matchId, rating - prev.rating);
      }
    }

    // 4) Season import, a few dozen games per sync.
    if (!player.backfillDone) {
      const season = await currentSeason(puuid);
      let start = player.backfillStart;
      let budget = BACKFILL_PER_SYNC;
      let done = false;
      while (budget > 0 && !done) {
        const pageStart = start;
        const page = await soloQueueIds(player.region, puuid, start, 100);
        if (!page.length) {
          done = true;
          break;
        }
        for (const id of page) {
          start++;
          if (known.has(id)) continue;
          if (budget-- <= 0) {
            start--;
            break;
          }
          const m = await src.match(player.region, id);
          if (season && seasonOf(m) < season) {
            done = true; // reached the previous season
            break;
          }
          const row = summarize(m, puuid);
          if (row) {
            await repo.putPlayerMatch(puuid, row);
            known.add(id);
            result.backfill.stored++;
          }
        }
        if (page.length < 100 && start >= pageStart + page.length) done = true;
      }
      player.backfillStart = start;
      player.backfillDone = done;
      result.backfill.done = done;
    }
  } catch (e) {
    if (!(e instanceof RateLimitError)) throw e;
    result.limited = true;
  }

  await refreshIdentity(player).catch(() => {});
  player.syncedAt = Date.now();
  await repo.upsertPlayer(player);
  return result;
}

/** Season of the player's newest stored game (Riot's major patch number, e.g. 16 for 2026). */
async function currentSeason(puuid: string) {
  const rows = await getRepo().playerMatches(puuid);
  return rows.length ? Math.max(...rows.map((r) => r.season)) : 0;
}

async function refreshIdentity(p: TrackedPlayer) {
  const s = await riotSource.summoner(p.region, p.puuid);
  p.profileIcon = s.profileIconId;
  p.level = s.summonerLevel;
}

/** Track a player: resolve the Riot ID, store them and (unless `sync: false`) run a first sync. */
export async function addPlayer(region: string, name: string, tag: string, opts: { sync?: boolean } = {}) {
  const repo = getRepo();
  const acc = await riotSource.account(region, name, tag);
  const existing = await repo.getPlayer(acc.puuid);
  if (existing) return existing;
  const player: TrackedPlayer = {
    puuid: acc.puuid,
    gameName: acc.gameName.trim(),
    tagLine: acc.tagLine.trim(),
    region,
    slug: slugOf(acc.gameName.trim(), acc.tagLine.trim()),
    profileIcon: null,
    level: null,
    addedAt: Date.now(),
    backfillStart: 0,
    backfillDone: false,
    syncedAt: null,
  };
  await repo.upsertPlayer(player);
  if (opts.sync !== false) await syncPlayer(player.puuid).catch(() => null);
  return player;
}
