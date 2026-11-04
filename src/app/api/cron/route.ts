import { NextResponse } from 'next/server';
import { getRepo } from '@/server/repo';
import { syncPlayer } from '@/server/tracker';

export const maxDuration = 60;

/**
 * Background sync of every tracked player. Call it from Vercel Cron or any external cron with
 * `Authorization: Bearer $CRON_SECRET` (Vercel adds that header itself) or `?secret=`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get('authorization')?.replace('Bearer ', '') ?? url.searchParams.get('secret');
  if (!secret || given !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const out: Record<string, unknown> = {};
  for (const p of await getRepo().listPlayers()) {
    try {
      const r = await syncPlayer(p.puuid);
      out[p.slug] = { new: r.newMatches.length, imported: r.backfill.stored, done: r.backfill.done, limited: r.limited };
      if (r.limited) break;
    } catch (e) {
      out[p.slug] = { error: String(e) };
    }
  }
  return NextResponse.json(out);
}
