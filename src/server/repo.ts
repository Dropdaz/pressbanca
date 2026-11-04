import 'server-only';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LeagueEntryDto, MatchDto, TimelineDto } from '@/games/lol/dto';

/**
 * Storage for the personal tracker. Supabase (Postgres) when SUPABASE_URL + SUPABASE_SECRET_KEY are
 * set — schema in supabase/migrations — otherwise JSON files under `.data/` for local development.
 * Both implement the same interface, so the rest of the app doesn't care.
 */

export interface TrackedPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  slug: string;
  profileIcon: number | null;
  level: number | null;
  addedAt: number;
  backfillStart: number;
  backfillDone: boolean;
  syncedAt: number | null;
}

/** Light per-game row for history / champions / improvement views. */
export interface MatchSummaryRow {
  matchId: string;
  season: number;
  queueId: number;
  endedAt: number;
  durationSec: number;
  win: boolean;
  remake: boolean;
  champion: string;
  role: string;
  k: number;
  d: number;
  a: number;
  cs: number;
  cs10: number;
  gold: number;
  damage: number;
  damageShare: number;
  killParticipation: number;
  visionScore: number;
  controlWards: number;
  score: number;
  /** Rank by score among all 10 players / within the player's team (1 = best). Missing on old rows. */
  place?: number;
  teamPlace?: number;
  opponent: string | null;
  items: number[];
  lpDelta: number | null;
}

export interface RankSnapshotRow {
  queueType: string;
  rating: number;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  takenAt: number;
}

export interface Repo {
  kind: 'supabase' | 'local';
  listPlayers(): Promise<TrackedPlayer[]>;
  getPlayer(slugOrPuuid: string): Promise<TrackedPlayer | null>;
  upsertPlayer(p: TrackedPlayer): Promise<void>;
  removePlayer(puuid: string): Promise<void>;

  getMatch(id: string): Promise<MatchDto | null>;
  putMatch(region: string, m: MatchDto): Promise<void>;
  getTimeline(id: string): Promise<TimelineDto | null>;
  putTimeline(id: string, t: TimelineDto): Promise<void>;

  playerMatches(puuid: string, season?: number): Promise<MatchSummaryRow[]>;
  /** Just the stored match ids (cheap: what every sync needs). */
  playerMatchIds(puuid: string): Promise<string[]>;
  /** Non-remake summaries still missing the lobby placement (see tracker step 0). */
  staleSummaries(puuid: string, limit: number): Promise<MatchSummaryRow[]>;
  putPlayerMatch(puuid: string, row: MatchSummaryRow): Promise<void>;
  setLpDelta(puuid: string, matchId: string, lp: number): Promise<void>;

  snapshots(puuid: string): Promise<RankSnapshotRow[]>;
  addSnapshot(puuid: string, s: RankSnapshotRow): Promise<void>;

  getLeague(puuid: string): Promise<{ entries: LeagueEntryDto[]; fetchedAt: number } | null>;
  putLeague(puuid: string, entries: LeagueEntryDto[]): Promise<void>;

  getNotes(puuid: string): Promise<Record<string, unknown>>;
  putNotes(puuid: string, data: Record<string, unknown>): Promise<void>;
}

export const seasonOf = (m: MatchDto) => Number((m.info as { gameVersion?: string }).gameVersion?.split('.')[0] ?? 0);

// ───────────────────────── Supabase ─────────────────────────

function supabaseRepo(sb: SupabaseClient): Repo {
  const must = <T,>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
    return r.data;
  };
  const toPlayer = (r: Record<string, unknown>): TrackedPlayer => ({
    puuid: r.puuid as string,
    gameName: r.game_name as string,
    tagLine: r.tag_line as string,
    region: r.region as string,
    slug: r.slug as string,
    profileIcon: (r.profile_icon as number) ?? null,
    level: (r.level as number) ?? null,
    addedAt: Date.parse(r.added_at as string),
    backfillStart: r.backfill_start as number,
    backfillDone: r.backfill_done as boolean,
    syncedAt: r.synced_at ? Date.parse(r.synced_at as string) : null,
  });
  return {
    kind: 'supabase',
    async listPlayers() {
      return (must(await sb.from('players').select('*').order('added_at')) as Record<string, unknown>[]).map(toPlayer);
    },
    async getPlayer(key) {
      const r = must(await sb.from('players').select('*').or(`slug.eq.${key},puuid.eq.${key}`).limit(1)) as Record<string, unknown>[];
      return r[0] ? toPlayer(r[0]) : null;
    },
    async upsertPlayer(p) {
      must(
        await sb.from('players').upsert({
          puuid: p.puuid,
          game_name: p.gameName,
          tag_line: p.tagLine,
          region: p.region,
          slug: p.slug,
          profile_icon: p.profileIcon,
          level: p.level,
          added_at: new Date(p.addedAt).toISOString(),
          backfill_start: p.backfillStart,
          backfill_done: p.backfillDone,
          synced_at: p.syncedAt ? new Date(p.syncedAt).toISOString() : null,
        }),
      );
    },
    async removePlayer(puuid) {
      must(await sb.from('players').delete().eq('puuid', puuid));
    },
    async getMatch(id) {
      const r = must(await sb.from('matches').select('data').eq('match_id', id).limit(1)) as { data: MatchDto }[];
      return r[0]?.data ?? null;
    },
    async putMatch(region, m) {
      must(
        await sb.from('matches').upsert(
          { match_id: m.metadata.matchId, region, queue_id: m.info.queueId, season: seasonOf(m), ended_at: new Date(m.info.gameEndTimestamp ?? m.info.gameCreation).toISOString(), data: m },
          { onConflict: 'match_id', ignoreDuplicates: true },
        ),
      );
    },
    async getTimeline(id) {
      const r = must(await sb.from('matches').select('timeline').eq('match_id', id).limit(1)) as { timeline: TimelineDto | null }[];
      return r[0]?.timeline ?? null;
    },
    async putTimeline(id, t) {
      must(await sb.from('matches').update({ timeline: t }).eq('match_id', id));
    },
    async playerMatches(puuid, season) {
      let q = sb.from('player_matches').select('summary, lp_delta').eq('puuid', puuid).order('ended_at', { ascending: false }).limit(2000);
      if (season != null) q = q.eq('season', season);
      return (must(await q) as { summary: MatchSummaryRow; lp_delta: number | null }[]).map((r) => ({ ...r.summary, lpDelta: r.lp_delta }));
    },
    async playerMatchIds(puuid) {
      return (must(await sb.from('player_matches').select('match_id').eq('puuid', puuid).limit(5000)) as { match_id: string }[]).map((r) => r.match_id);
    },
    async staleSummaries(puuid, limit) {
      const q = sb.from('player_matches').select('summary, lp_delta').eq('puuid', puuid).is('summary->place', null).neq('summary->>remake', 'true').limit(limit);
      return (must(await q) as { summary: MatchSummaryRow; lp_delta: number | null }[]).map((r) => ({ ...r.summary, lpDelta: r.lp_delta }));
    },
    async putPlayerMatch(puuid, row) {
      must(
        await sb.from('player_matches').upsert({ puuid, match_id: row.matchId, season: row.season, queue_id: row.queueId, ended_at: new Date(row.endedAt).toISOString(), summary: row }, { onConflict: 'puuid,match_id' }),
      );
    },
    async setLpDelta(puuid, matchId, lp) {
      must(await sb.from('player_matches').update({ lp_delta: lp }).eq('puuid', puuid).eq('match_id', matchId));
    },
    async snapshots(puuid) {
      const r = must(await sb.from('rank_snapshots').select('*').eq('puuid', puuid).order('taken_at')) as Record<string, unknown>[];
      return r.map((x) => ({ queueType: x.queue_type as string, rating: x.rating as number, tier: x.tier as string, division: x.division as string, lp: x.lp as number, wins: x.wins as number, losses: x.losses as number, takenAt: Date.parse(x.taken_at as string) }));
    },
    async addSnapshot(puuid, s) {
      must(await sb.from('rank_snapshots').insert({ puuid, queue_type: s.queueType, rating: s.rating, tier: s.tier, division: s.division, lp: s.lp, wins: s.wins, losses: s.losses, taken_at: new Date(s.takenAt).toISOString() }));
    },
    async getLeague(puuid) {
      const r = must(await sb.from('league_cache').select('entries, fetched_at').eq('puuid', puuid).limit(1)) as { entries: LeagueEntryDto[]; fetched_at: string }[];
      return r[0] ? { entries: r[0].entries, fetchedAt: Date.parse(r[0].fetched_at) } : null;
    },
    async putLeague(puuid, entries) {
      must(await sb.from('league_cache').upsert({ puuid, entries, fetched_at: new Date().toISOString() }));
    },
    async getNotes(puuid) {
      const r = must(await sb.from('player_notes').select('data').eq('puuid', puuid).limit(1)) as { data: Record<string, unknown> }[];
      return r[0]?.data ?? {};
    },
    async putNotes(puuid, data) {
      must(await sb.from('player_notes').upsert({ puuid, data }));
    },
  };
}

// ───────────────────────── Local JSON files ─────────────────────────

function localRepo(root: string): Repo {
  const p = (...xs: string[]) => path.join(root, ...xs);
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  async function read<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }
  async function write(file: string, data: unknown) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  }
  const playersFile = p('tracker', 'players.json');
  const pm = (puuid: string) => p('tracker', 'player-matches', `${safe(puuid)}.json`);
  const snaps = (puuid: string) => p('tracker', 'snapshots', `${safe(puuid)}.json`);
  const notes = (puuid: string) => p('tracker', 'notes', `${safe(puuid)}.json`);
  const players = () => read<TrackedPlayer[]>(playersFile, []);
  return {
    kind: 'local',
    listPlayers: players,
    async getPlayer(key) {
      return (await players()).find((x) => x.slug === key || x.puuid === key) ?? null;
    },
    async upsertPlayer(pl) {
      const all = (await players()).filter((x) => x.puuid !== pl.puuid);
      await write(playersFile, [...all, pl].sort((a, b) => a.addedAt - b.addedAt));
    },
    async removePlayer(puuid) {
      await write(playersFile, (await players()).filter((x) => x.puuid !== puuid));
      await rm(pm(puuid), { force: true });
      await rm(snaps(puuid), { force: true });
    },
    getMatch: (id) => read<MatchDto | null>(p('matches', `${safe(id)}.json`), null),
    putMatch: (_region, m) => write(p('matches', `${safe(m.metadata.matchId)}.json`), m),
    getTimeline: (id) => read<TimelineDto | null>(p('timelines', `${safe(id)}.json`), null),
    putTimeline: (id, t) => write(p('timelines', `${safe(id)}.json`), t),
    async playerMatches(puuid, season) {
      const rows = await read<MatchSummaryRow[]>(pm(puuid), []);
      return rows.filter((r) => season == null || r.season === season).sort((a, b) => b.endedAt - a.endedAt);
    },
    async playerMatchIds(puuid) {
      return (await read<MatchSummaryRow[]>(pm(puuid), [])).map((r) => r.matchId);
    },
    async staleSummaries(puuid, limit) {
      return (await read<MatchSummaryRow[]>(pm(puuid), [])).filter((r) => r.place === undefined && !r.remake).slice(0, limit);
    },
    async putPlayerMatch(puuid, row) {
      const rows = (await read<MatchSummaryRow[]>(pm(puuid), [])).filter((r) => r.matchId !== row.matchId);
      const old = (await read<MatchSummaryRow[]>(pm(puuid), [])).find((r) => r.matchId === row.matchId);
      await write(pm(puuid), [...rows, { ...row, lpDelta: row.lpDelta ?? old?.lpDelta ?? null }]);
    },
    async setLpDelta(puuid, matchId, lp) {
      const rows = await read<MatchSummaryRow[]>(pm(puuid), []);
      await write(pm(puuid), rows.map((r) => (r.matchId === matchId ? { ...r, lpDelta: lp } : r)));
    },
    snapshots: (puuid) => read<RankSnapshotRow[]>(snaps(puuid), []),
    async addSnapshot(puuid, s) {
      await write(snaps(puuid), [...(await read<RankSnapshotRow[]>(snaps(puuid), [])), s]);
    },
    getLeague: (puuid) => read<{ entries: LeagueEntryDto[]; fetchedAt: number } | null>(p('league', `${safe(puuid)}.json`), null),
    putLeague: (puuid, entries) => write(p('league', `${safe(puuid)}.json`), { entries, fetchedAt: Date.now() }),
    getNotes: (puuid) => read<Record<string, unknown>>(notes(puuid), {}),
    putNotes: (puuid, data) => write(notes(puuid), data),
  };
}

// Listing helper used by local maintenance scripts.
export async function localMatchCount(root = path.join(process.cwd(), '.data', 'matches')) {
  try {
    return (await readdir(root)).length;
  } catch {
    return 0;
  }
}

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (repo) return repo;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  repo = url && key ? supabaseRepo(createClient(url, key, { auth: { persistSession: false } })) : localRepo(process.env.PB_DATA_DIR ?? path.join(process.cwd(), '.data'));
  return repo;
}
