/**
 * Summoner's Rift geometry (game units, 0–~14,800). Blue base bottom-left, red base top-right; mid
 * lane runs along x ≈ y, the river along x + y ≈ 14,800.
 */

export type Zone = 'base' | 'top lane' | 'mid lane' | 'bot lane' | 'river' | 'own jungle' | 'enemy jungle';

const SIZE = 14800;

export function zoneOf(pos: { x: number; y: number }, teamId: number): Zone {
  const { x, y } = pos;
  const blueBase = x < 2600 && y < 2600;
  const redBase = x > 12200 && y > 12200;
  if (blueBase || redBase) return 'base';
  if (x < 2200 || y > 12600) return 'top lane';
  if (y < 2200 || x > 12600) return 'bot lane';
  if (Math.abs(x - y) < 1500) return 'mid lane';
  if (Math.abs(x + y - SIZE) < 1400) return 'river';
  const blueSide = x + y < SIZE;
  return blueSide === (teamId === 100) ? 'own jungle' : 'enemy jungle';
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
