import { NextResponse } from 'next/server';
import { riotStatus } from '@/games/lol/riot';

export const dynamic = 'force-dynamic';

/** Riot API rate-limit state of this server instance, for the status pill. */
export function GET() {
  return NextResponse.json(riotStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
