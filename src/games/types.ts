import type { MatchDetailView, ProfileView } from '@/core/types';

export interface RegionOption {
  /** URL / UI id, e.g. "EUW" */
  id: string;
  label: string;
}

/** Client-safe description of a game (tabs, search box, regions). */
export interface GameMeta {
  id: string;
  /** Tab label: "LoL" */
  short: string;
  /** "League of Legends" */
  name: string;
  status: 'live' | 'soon';
  regions: RegionOption[];
  defaultRegion: string;
  /** Placeholder for the search input. */
  idHint: string;
}

/**
 * Contract every game implements on the server. Adding a game = a meta + a module, registered in
 * `catalog.ts` and `registry.ts`; pages, API routes and components only talk to these interfaces.
 */
export interface GameModule extends GameMeta {
  getProfile?(region: string, query: PlayerQuery): Promise<ProfileView>;
  getMatch?(region: string, matchId: string, player: PlayerQuery): Promise<MatchDetailView>;
  /** Drop cached data for a player so the next read is fresh. Returns the tags to revalidate. */
  refreshTags?(puuid: string): string[];
}

export interface PlayerQuery {
  name: string;
  tag: string;
}

/** "Nightlark#EUW" or "Nightlark-EUW" → { name, tag }. Tags never contain "-" or "#". */
export function parsePlayerQuery(raw: string, fallbackTag: string): PlayerQuery | null {
  const s = decodeURIComponent(raw).trim();
  if (!s) return null;
  const i = Math.max(s.lastIndexOf('#'), s.lastIndexOf('-'));
  if (i <= 0) return { name: s, tag: fallbackTag };
  const name = s.slice(0, i).trim();
  const tag = s.slice(i + 1).trim();
  if (!name) return null;
  return { name, tag: tag || fallbackTag };
}

export function playerSlug(q: PlayerQuery) {
  return encodeURIComponent(`${q.name}-${q.tag}`);
}
