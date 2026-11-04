import 'server-only';
import type { LolSource } from '@/games/lol/dto';
import { riotSource } from '@/games/lol/riot';
import { getRepo } from './repo';

/** League entries of other players are reused for this long (lobby ranks barely move in a day). */
const OTHERS_TTL = 24 * 3600_000;

/**
 * Read-through cache over the Riot API: matches and timelines are fetched once and kept forever,
 * league entries of lobby players are reused for a day. Tracked players' own ranks are always fresh
 * (they come from the sync job, see tracker.ts).
 */
export function persistentSource(): LolSource {
  const repo = getRepo();
  const riot = riotSource;
  return {
    demo: false,
    account: riot.account,
    summoner: riot.summoner,
    matchIds: riot.matchIds,
    activeGame: riot.activeGame,
    async league(region, puuid) {
      const hit = await repo.getLeague(puuid);
      if (hit && Date.now() - hit.fetchedAt < OTHERS_TTL) return hit.entries;
      const entries = await riot.league(region, puuid);
      await repo.putLeague(puuid, entries).catch(() => {});
      return entries;
    },
    async match(region, id) {
      const hit = await repo.getMatch(id);
      if (hit) return hit;
      const m = await riot.match(region, id);
      await repo.putMatch(region, m).catch(() => {});
      return m;
    },
    async timeline(region, id) {
      const hit = await repo.getTimeline(id);
      if (hit) return hit;
      const t = await riot.timeline(region, id);
      // The match row must exist first (FK); it does whenever the timeline is asked for a known game.
      if (!(await repo.getMatch(id))) await repo.putMatch(region, await riot.match(region, id)).catch(() => {});
      await repo.putTimeline(id, t).catch(() => {});
      return t;
    },
  };
}
