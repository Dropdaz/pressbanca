'use server';

import { revalidateTag } from 'next/cache';
import { getGame } from '@/games/registry';
import { getRepo } from '@/server/repo';

/** "Update" button: forget cached rank and match list for a player so the next render is fresh. */
export async function refreshPlayer(gameId: string, puuid: string) {
  for (const tag of getGame(gameId)?.refreshTags?.(puuid) ?? []) revalidateTag(tag);
}

/** Save the LP the player last won and lost in a queue; it anchors their MMR and LP forecast. */
export async function saveLpReference(gameId: string, puuid: string, queue: string, win: number, loss: number) {
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 60;
  const repo = getRepo();
  if (gameId !== 'lol' || queue !== 'solo/duo' || !ok(win) || !ok(loss) || !(await repo.getPlayer(puuid))) return { ok: false };
  await repo.putNotes(puuid, { ...(await repo.getNotes(puuid)), lpReference: { win, loss, at: Date.now() } });
  return { ok: true };
}

