import { NextResponse } from 'next/server';
import { RateLimitError } from '@/core/errors';
import { liveGame } from '@/server/live';
import { getRepo } from '@/server/repo';

/** GET: the tracked player's game in progress ({ live: null } when not in game). */
export async function GET(_req: Request, { params }: { params: Promise<{ puuid: string }> }) {
  const { puuid } = await params;
  const repo = getRepo();
  const player = await repo.getPlayer(puuid);
  if (!player) return NextResponse.json({ error: 'not tracked' }, { status: 404 });
  const notes = await repo.getNotes(puuid);
  const ref = notes.lpReference as { win: number; loss: number } | undefined;
  try {
    return NextResponse.json({ live: await liveGame(player, ref ?? null) });
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ live: null, limited: true });
    console.error(e);
    return NextResponse.json({ live: null });
  }
}
