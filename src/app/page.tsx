import { Selector, type PlayerCard } from '@/components/home/Selector';
import { ddragon } from '@/games/lol/ddragon';
import { rankLabel, toRating } from '@/games/lol/ranks';
import { getRepo } from '@/server/repo';
import { rosterPlayers } from '@/server/roster';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const repo = getRepo();
  const dd = await ddragon();
  const players = await rosterPlayers();
  const cards: PlayerCard[] = await Promise.all(
    players.map(async (p) => {
      const league = await repo.getLeague(p.puuid);
      const solo = league?.entries.find((e) => e.queueType === 'RANKED_SOLO_5x5');
      const rank = solo ? rankLabel(toRating(solo.tier, solo.rank, solo.leaguePoints)) : null;
      const rows = await repo.playerMatches(p.puuid);
      const season = rows.length ? Math.max(...rows.map((r) => r.season)) : 0;
      const current = rows.filter((r) => r.season === season && !r.remake);
      const last = current[0];
      return {
        puuid: p.puuid,
        slug: p.slug,
        name: p.gameName,
        tag: p.tagLine,
        region: p.region,
        icon: p.profileIcon != null ? dd.iconImg(p.profileIcon) : null,
        level: p.level,
        rank: rank ? { label: rank.label, color: rank.color, lp: solo!.leaguePoints } : null,
        season: solo ? { wins: solo.wins, losses: solo.losses } : null,
        stored: current.length,
        importing: !p.backfillDone,
        last: last ? { champion: dd.championName(last.champion), image: dd.championImg(last.champion), win: last.win, endedAt: last.endedAt, k: last.k, d: last.d, a: last.a } : null,
        form: current.slice(0, 10).map((r) => r.win),
      };
    }),
  );
  return <Selector players={cards} storage={repo.kind} hasKey={Boolean(process.env.RIOT_API_KEY)} />;
}
