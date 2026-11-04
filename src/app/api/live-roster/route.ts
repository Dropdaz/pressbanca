import { NextResponse } from 'next/server';
import { RateLimitError } from '@/core/errors';
import { ddragon } from '@/games/lol/ddragon';
import { riotSource } from '@/games/lol/riot';
import { LIVE_QUEUE_NAMES } from '@/server/live';
import { rosterPlayers } from '@/server/roster';

export const dynamic = 'force-dynamic';

/** Who on the roster is in a game right now (one spectator call each, cached 30 s). */
export async function GET() {
  const [players, dd] = await Promise.all([rosterPlayers(), ddragon()]);
  const out: Record<string, { startedAt: number; queue: string; champion: string; image: string | null } | null> = {};
  let limited = false;
  for (const p of players) {
    try {
      const g = await riotSource.activeGame(p.region, p.puuid);
      const me = g?.participants.find((x) => x.puuid === p.puuid);
      const champ = me ? dd.championIdOf(me.championId) : null;
      out[p.puuid] = g ? { startedAt: g.gameStartTime, queue: LIVE_QUEUE_NAMES[g.gameQueueConfigId] ?? 'Personalizada', champion: champ ? dd.championName(champ) : '', image: champ ? dd.championImg(champ) : null } : null;
    } catch (e) {
      if (e instanceof RateLimitError) {
        limited = true;
        break;
      }
      out[p.puuid] = null;
    }
  }
  return NextResponse.json({ live: out, limited }, { headers: { 'Cache-Control': 'no-store' } });
}
