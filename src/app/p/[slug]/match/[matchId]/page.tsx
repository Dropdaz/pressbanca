import { ErrorState } from '@/components/ErrorState';
import { CoachReport } from '@/components/match/CoachReport';
import { MatchDetail } from '@/components/match/MatchDetail';
import { toErrorView, type AppErrorView } from '@/core/errors';
import type { MatchDetailView } from '@/core/types';
import { buildMatch } from '@/games/lol/match';
import { loadPlayer } from '@/server/player';
import { getRepo } from '@/server/repo';
import { summarize } from '@/server/tracker';

export const metadata = { title: 'Análisis de partida' };

export default async function MatchPage({ params }: { params: Promise<{ slug: string; matchId: string }> }) {
  const { slug, matchId } = await params;
  const { player } = await loadPlayer(slug);
  const id = decodeURIComponent(matchId);
  let data: MatchDetailView | null = null;
  let error: AppErrorView | null = null;
  try {
    data = await buildMatch(player.region, id, { name: player.gameName, tag: player.tagLine });
    // Opening a game we didn't have yet (e.g. a friend's game) adds it to the history.
    const repo = getRepo();
    const m = await repo.getMatch(id);
    if (m && !(await repo.playerMatches(player.puuid)).some((r) => r.matchId === id)) {
      const row = summarize(m, player.puuid);
      if (row) await repo.putPlayerMatch(player.puuid, row);
    }
  } catch (e) {
    error = toErrorView(e);
  }
  if (!data) return <ErrorState error={error!} game="lol" region={player.region} />;
  return <MatchDetail d={data}>{data.analysis && <CoachReport a={data.analysis} />}</MatchDetail>;
}
