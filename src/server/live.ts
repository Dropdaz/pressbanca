import 'server-only';
import { mean } from '@/core/math';
import { winChance } from '@/core/lp';
import type { LiveGameView, LivePlayer } from '@/core/types';
import { ddragon } from '@/games/lol/ddragon';
import { readRanks, ratingOf } from '@/games/lol/profile';
import { rankLabel } from '@/games/lol/ranks';
import { persistentSource } from './persistent';
import type { TrackedPlayer } from './repo';

export const LIVE_QUEUE_NAMES: Record<number, string> = { 420: 'Clasificatoria Solo/Dúo', 440: 'Clasificatoria Flexible', 400: 'Normal (selección)', 430: 'Normal (a ciegas)', 490: 'Partida rápida', 450: 'ARAM', 1700: 'Arena', 1900: 'URF' };

export interface LiveGameData extends LiveGameView {
  gameId: number;
  /** Your history on the champion you're playing, from stored games. */
  champion: string;
}

/** The tracked player's game in progress, or null. Lobby ranks come from the 24 h league cache. */
export async function liveGame(player: TrackedPlayer, lp: { win: number; loss: number } | null): Promise<LiveGameData | null> {
  const src = persistentSource();
  const game = await src.activeGame(player.region, player.puuid);
  if (!game) return null;
  const dd = await ddragon();
  const ids = game.participants.map((p) => p.puuid).filter((p): p is string => !!p);
  const ranks = await readRanks(src, player.region, ids);
  const myTeam = game.participants.find((p) => p.puuid === player.puuid)?.teamId ?? 100;
  const mine = game.participants.find((p) => p.puuid === player.puuid);
  const teams = [myTeam, myTeam === 100 ? 200 : 100].map((teamId) => {
    const ps = game.participants.filter((p) => p.teamId === teamId);
    const players: LivePlayer[] = ps.map((p) => {
      const [name, tag] = (p.riotId ?? 'Oculto#').split('#');
      const champ = dd.championIdOf(p.championId);
      const r = p.puuid ? ranks.get(p.puuid) : null;
      return { name, tag: tag ?? '', champion: champ ? dd.championName(champ) : 'Desconocido', image: champ ? dd.championImg(champ) : null, rank: r != null ? rankLabel(r) : null, me: p.puuid === player.puuid };
    });
    const ratings = ps.map((p) => (p.puuid ? ranks.get(p.puuid) : null)).filter((v): v is number => v != null);
    return { mine: teamId === myTeam, avg: ratings.length ? rankLabel(mean(ratings)) : null, players, ratings };
  });
  const [a, b] = teams;
  const champId = mine ? dd.championIdOf(mine.championId) : null;
  return {
    gameId: game.gameId,
    queue: LIVE_QUEUE_NAMES[game.gameQueueConfigId] ?? 'Personalizada',
    startedAt: game.gameStartTime,
    teams: teams.map(({ mine: m, avg, players }) => ({ mine: m, avg, players })),
    winChance: a.ratings.length >= 3 && b.ratings.length >= 3 ? Math.round(100 * winChance(mean(a.ratings), mean(b.ratings))) : null,
    lp: game.gameQueueConfigId === 420 ? lp : null,
    champion: champId ?? '',
  };
}

export { ratingOf };
