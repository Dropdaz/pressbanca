import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ddragon } from '@/games/lol/ddragon';
import { buildProfile } from '@/games/lol/profile';
import { isApex, rankLabel, toRating, type Tier } from '@/games/lol/ranks';
import type { ShownRank } from '@/core/types';
import { getRepo } from './repo';

/** Everything the player pages share, loaded once per request. */
export const loadPlayer = cache(async (slug: string) => {
  const repo = getRepo();
  const player = await repo.getPlayer(decodeURIComponent(slug).toLowerCase());
  if (!player) notFound();
  const [dd, league, all] = await Promise.all([ddragon(), repo.getLeague(player.puuid), repo.playerMatches(player.puuid)]);
  const solo = league?.entries.find((e) => e.queueType === 'RANKED_SOLO_5x5') ?? null;
  let shown: ShownRank | null = null;
  if (solo) {
    const rating = toRating(solo.tier, solo.rank, solo.leaguePoints);
    shown = {
      ...rankLabel(rating),
      lp: solo.leaguePoints,
      progress: isApex(solo.tier as Tier) ? Math.min(1, solo.leaguePoints / 1000) : solo.leaguePoints / 100,
      queueLabel: 'Ranked Solo/Duo',
      seasonGames: solo.wins + solo.losses,
    };
  }
  // A new season starts from zero: only its games count for stats (MMR still uses recent lobbies).
  const season = all.length ? Math.max(...all.map((r) => r.season)) : 0;
  const rows = all.filter((r) => r.season === season);
  return { player, dd, shown, solo, season, rows, all };
});

/** The analytics profile (MMR, outlook, benchmarks) for a tracked player. */
export const loadProfile = cache(async (slug: string) => {
  const { player } = await loadPlayer(slug);
  return buildProfile(player.region, { name: player.gameName, tag: player.tagLine });
});
