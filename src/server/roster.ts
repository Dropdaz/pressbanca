import 'server-only';
import { addPlayer } from './tracker';
import { getRepo, type TrackedPlayer } from './repo';

/** The only profiles PressBanca shows: the owner and friends. Edit this list to add or remove someone. */
export const ROSTER: { region: string; name: string; tag: string }[] = [
  { region: 'EUW', name: 'ErnieDj', tag: 'EUW' },
  { region: 'EUW', name: 'jupro12', tag: 'EUW' },
  { region: 'EUW', name: 'Danielrayo12', tag: 'EUW' },
  { region: 'EUW', name: 'Maniins', tag: '8462' },
  { region: 'EUW', name: 'LinkinAvicii', tag: '1233' },
  { region: 'EUW', name: 'Joaanggg03', tag: '8321' },
  { region: 'EUW', name: 'ElPete', tag: '6459' },
];

const idOf = (name: string, tag: string) => `${name}#${tag}`.toLowerCase();

/**
 * Tracked players in roster order. Anyone on the roster who isn't stored yet is registered (one
 * account lookup each); their season import then runs through the normal background sync.
 */
export async function rosterPlayers(): Promise<TrackedPlayer[]> {
  const repo = getRepo();
  let stored = await repo.listPlayers();
  const missing = ROSTER.filter((r) => !stored.some((p) => idOf(p.gameName, p.tagLine) === idOf(r.name, r.tag)));
  if (missing.length) {
    for (const r of missing) await addPlayer(r.region, r.name, r.tag, { sync: false }).catch((e) => console.error(`roster: ${r.name}#${r.tag}`, e));
    stored = await repo.listPlayers();
  }
  const order = ROSTER.map((r) => idOf(r.name, r.tag));
  return stored
    .filter((p) => order.includes(idOf(p.gameName, p.tagLine)))
    .sort((a, b) => order.indexOf(idOf(a.gameName, a.tagLine)) - order.indexOf(idOf(b.gameName, b.tagLine)));
}
