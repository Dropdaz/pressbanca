import { NextResponse } from 'next/server';
import { getRepo } from '@/server/repo';
import { syncPlayer } from '@/server/tracker';

export const maxDuration = 60;

/** POST: pull new games / rank for one tracked player (also advances the season import). */
export async function POST(_req: Request, { params }: { params: Promise<{ puuid: string }> }) {
  const { puuid } = await params;
  if (!(await getRepo().getPlayer(puuid))) return NextResponse.json({ error: 'not tracked' }, { status: 404 });
  try {
    return NextResponse.json(await syncPlayer(puuid));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'sync failed' }, { status: 502 });
  }
}
