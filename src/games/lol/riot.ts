import 'server-only';
import { unstable_cache } from 'next/cache';
import { PlayerNotFoundError, RateLimitError, UpstreamError } from '@/core/errors';
import type { AccountDto, ActiveGameDto, LeagueEntryDto, LolSource, MatchDto, SummonerDto, TimelineDto } from './dto';
import { lolRegion } from './regions';

/**
 * Riot API client.
 * - Every call goes through `unstable_cache`, so cache hits never spend rate-limit budget.
 * - Two layers of limits, both enforced per routing host (euw1, europe, …) as Riot does:
 *   · app limits of the key (dev/personal key: 20 per 1 s and 100 per 120 s), shared by all calls;
 *   · method limits of each endpoint (see api-acces.md), e.g. league entries by tier: 50 per 10 s.
 *   Each is a sliding window kept at 90% of the real limit. A call waits until both have a free slot;
 *   if that wait would be long we surface the rate-limited state instead of hanging.
 * - Buckets sync with Riot's own counters (X-App-/X-Method-Rate-Limit-Count) and Retry-After, so
 *   several server instances sharing the key (e.g. Vercel lambdas) still back off together.
 */

const KEY = process.env.RIOT_API_KEY;
type Limits = [count: number, seconds: number][];
const parseLimits = (h: string): Limits => h.split(',').map((p) => p.split(':').map(Number) as [number, number]);
const APP_LIMITS = parseLimits(process.env.RIOT_RATE_LIMITS ?? '20:1,100:120');

/** Method limits of the key (from the developer portal), matched against the request path. */
const METHOD_LIMITS: [RegExp, Limits][] = [
  [/^\/riot\/account\/v1\/accounts\//, [[1000, 60]]],
  [/^\/lol\/summoner\/v4\//, [[1600, 60]]],
  [/^\/lol\/league\/v4\/entries\/by-puuid\//, [[20000, 10], [1200000, 600]]],
  [/^\/lol\/league\/v4\/(challenger|grandmaster|master)leagues\//, [[30, 10], [500, 600]]],
  [/^\/lol\/league(-exp)?\/v4\/entries\//, [[50, 10]]],
  [/^\/lol\/match\/v5\//, [[2000, 10]]],
  [/^\/lol\/spectator\/v5\//, [[3000, 10], [180000, 600]]],
  [/^\/lol\/champion-mastery\/v4\//, [[20000, 10], [1200000, 600]]],
];

/** Keep a little headroom under every limit for requests from other instances. */
const SAFETY = 0.9;
/** Longer than this and we surface the rate-limited state instead of hanging the request. */
const MAX_WAIT_MS = 8000;

interface Bucket {
  limits: Limits;
  stamps: number[];
  /** Nothing may be sent before this time (from Retry-After or a saturated Riot counter). */
  blockedUntil: number;
}
// On globalThis so every bundle in the process (pages, route handlers) shares one set of buckets.
const g = globalThis as typeof globalThis & { __riotBuckets?: Map<string, Bucket>; __riotKeyRejectedAt?: number };
const buckets = (g.__riotBuckets ??= new Map<string, Bucket>());
const bucket = (key: string, limits: Limits) => {
  let b = buckets.get(key);
  if (!b) buckets.set(key, (b = { limits, stamps: [], blockedUntil: 0 }));
  return b;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cap = (n: number) => Math.max(1, Math.floor(n * SAFETY));

function bucketsFor(host: string, path: string) {
  const m = METHOD_LIMITS.find(([re]) => re.test(path));
  return { app: bucket(`app:${host}`, APP_LIMITS), method: m ? bucket(`method:${host}:${m[0].source}`, m[1]) : null };
}

/** Milliseconds until this bucket can take one more request. */
function waitFor(b: Bucket, now: number) {
  let wait = Math.max(0, b.blockedUntil - now);
  for (const [n, sec] of b.limits) {
    const limit = cap(n);
    const from = now - sec * 1000;
    let count = 0;
    for (let i = b.stamps.length - 1; i >= 0 && b.stamps[i] > from; i--) count++;
    if (count >= limit) wait = Math.max(wait, b.stamps[b.stamps.length - limit] + sec * 1000 - now + 15);
  }
  return wait;
}

function record(b: Bucket, now: number) {
  b.stamps.push(now);
  const horizon = now - Math.max(...b.limits.map(([, s]) => s)) * 1000;
  while (b.stamps.length && b.stamps[0] < horizon) b.stamps.shift();
}

async function acquire(host: string, path: string) {
  const { app, method } = bucketsFor(host, path);
  const started = Date.now();
  for (;;) {
    const now = Date.now();
    const wait = Math.max(waitFor(app, now), method ? waitFor(method, now) : 0);
    if (wait === 0) {
      record(app, now);
      if (method) record(method, now);
      return;
    }
    if (now - started + wait > MAX_WAIT_MS) throw new RateLimitError(Math.ceil(wait / 1000));
    await sleep(wait);
  }
}

/** If Riot says a window is (nearly) full — counting other instances too — block until it rolls over. */
function syncFromHeaders(host: string, path: string, res: Response) {
  const { app, method } = bucketsFor(host, path);
  const now = Date.now();
  const sync = (b: Bucket | null, limitHeader: string, countHeader: string) => {
    const limitH = res.headers.get(limitHeader);
    const countH = res.headers.get(countHeader);
    if (!b || !limitH || !countH) return;
    const limits = new Map(parseLimits(limitH).map(([n, s]) => [s, n]));
    for (const [count, sec] of parseLimits(countH)) {
      const n = limits.get(sec);
      if (n && count >= cap(n)) b.blockedUntil = Math.max(b.blockedUntil, now + sec * 1000);
    }
  };
  sync(app, 'X-App-Rate-Limit', 'X-App-Rate-Limit-Count');
  sync(method, 'X-Method-Rate-Limit', 'X-Method-Rate-Limit-Count');
  if (res.status === 429) {
    const until = now + Number(res.headers.get('Retry-After') ?? 10) * 1000;
    // X-Rate-Limit-Type says which layer tripped; block that one (the app layer if unknown).
    const target = res.headers.get('X-Rate-Limit-Type') === 'method' && method ? method : app;
    target.blockedUntil = Math.max(target.blockedUntil, until);
  }
}

async function riotFetch<T>(host: string, path: string): Promise<T> {
  await acquire(host, path);
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
    headers: { 'X-Riot-Token': KEY ?? '' },
    cache: 'no-store',
  });
  syncFromHeaders(host, path, res);
  if (res.status === 404) throw new PlayerNotFoundError(path);
  if (res.status === 429) throw new RateLimitError(Number(res.headers.get('Retry-After') ?? 10));
  if (res.status === 401 || res.status === 403) g.__riotKeyRejectedAt = Date.now();
  else if (res.ok) g.__riotKeyRejectedAt = undefined;
  if (res.status === 401 || res.status === 403) throw new UpstreamError(res.status, 'Riot rechazó la clave de la API. Las claves de desarrollo caducan cada 24 horas.');
  if (!res.ok) throw new UpstreamError(res.status, `Error de la API de Riot ${res.status}`);
  return res.json() as Promise<T>;
}

const DAY = 86400;
const cached = <T,>(host: string, path: string, revalidate: number, tags: string[] = []) =>
  unstable_cache(() => riotFetch<T>(host, path), ['riot', host, path], { revalidate, tags })();

export const playerTag = (puuid: string) => `player:${puuid}`;

function hosts(regionId: string) {
  const r = lolRegion(regionId);
  if (!r) throw new UpstreamError(400, `Región desconocida ${regionId}`);
  return r;
}

export const riotSource: LolSource = {
  demo: false,
  async account(region, name, tag) {
    try {
      return await cached<AccountDto>(hosts(region).account, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, DAY);
    } catch (e) {
      if (e instanceof PlayerNotFoundError) throw new PlayerNotFoundError(`${name}#${tag}`);
      throw e;
    }
  },
  summoner: (region, puuid) => cached<SummonerDto>(hosts(region).platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`, DAY / 4, [playerTag(puuid)]),
  // Short revalidation so rank snapshots catch single games (real LP tracking).
  league: (region, puuid) => cached<LeagueEntryDto[]>(hosts(region).platform, `/lol/league/v4/entries/by-puuid/${puuid}`, 120, [playerTag(puuid)]),
  matchIds: (region, puuid, count) => cached<string[]>(hosts(region).regional, `/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&start=0&count=${count}`, 120, [playerTag(puuid)]),
  // Finished matches never change.
  match: (region, id) => cached<MatchDto>(hosts(region).regional, `/lol/match/v5/matches/${id}`, 30 * DAY),
  timeline: (region, id) => cached<TimelineDto>(hosts(region).regional, `/lol/match/v5/matches/${id}/timeline`, 30 * DAY),
  async activeGame(region, puuid) {
    try {
      return await cached<ActiveGameDto>(hosts(region).platform, `/lol/spectator/v5/active-games/by-summoner/${puuid}`, 30, [playerTag(puuid)]);
    } catch (e) {
      if (e instanceof PlayerNotFoundError) return null; // not in game
      throw e;
    }
  },
};

export const hasRiotKey = () => Boolean(KEY);

export interface RiotStatus {
  hasKey: boolean;
  keyRejected: boolean;
  /** Epoch ms until which no new request can go out (null = ready now). */
  cooldownUntil: number | null;
  /** Usage of the key's app windows on the busiest host. */
  windows: { host: string; used: number; limit: number; seconds: number }[];
  now: number;
}

/** Snapshot of this server instance's rate-limit state (spends no requests). */
export function riotStatus(): RiotStatus {
  const now = Date.now();
  let wait = 0;
  const windows: RiotStatus['windows'] = [];
  for (const [key, b] of buckets) {
    // Method buckets only count when Riot told us to back off; app buckets also when full.
    wait = Math.max(wait, key.startsWith('app:') ? waitFor(b, now) : Math.max(0, b.blockedUntil - now));
    if (!key.startsWith('app:')) continue;
    for (const [n, sec] of b.limits) {
      const used = b.stamps.filter((s) => s > now - sec * 1000).length;
      windows.push({ host: key.slice(4), used, limit: n, seconds: sec });
    }
  }
  // Busiest host first, longest window first.
  windows.sort((x, y) => y.used / y.limit - x.used / x.limit || y.seconds - x.seconds);
  return { hasKey: Boolean(KEY), keyRejected: Boolean(g.__riotKeyRejectedAt), cooldownUntil: wait > 0 ? now + wait : null, windows, now };
}

/** One page of Ranked Solo/Duo match ids, newest first (cached a minute). Used by the tracker. */
export function soloQueueIds(region: string, puuid: string, start: number, count: number) {
  return cached<string[]>(hosts(region).regional, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=${start}&count=${count}`, 60, [playerTag(puuid)]);
}

/** Fresh league entries (bypasses any longer-lived store), for the tracked players themselves. */
export const freshLeague = (region: string, puuid: string) => riotSource.league(region, puuid);
