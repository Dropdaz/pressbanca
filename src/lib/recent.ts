/** Recently searched players, kept per browser. Storage can be unavailable; never throw. */

export interface RecentPlayer {
  game: string;
  region: string;
  name: string;
  tag: string;
  rank: string;
  est: string;
  color: string;
}

const KEY = 'pb-recent';

export function readRecent(): RecentPlayer[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentPlayer[];
  } catch {
    return [];
  }
}

export function pushRecent(p: RecentPlayer) {
  try {
    const same = (x: RecentPlayer) => x.game === p.game && x.region === p.region && x.name.toLowerCase() === p.name.toLowerCase() && x.tag.toLowerCase() === p.tag.toLowerCase();
    localStorage.setItem(KEY, JSON.stringify([p, ...readRecent().filter((x) => !same(x))].slice(0, 6)));
  } catch {
    /* storage blocked */
  }
}
