import 'server-only';
import { unstable_cache } from 'next/cache';

/** Data Dragon: Riot's static CDN for champion, item and profile-icon art. */

const CDN = 'https://ddragon.leagueoflegends.com';
const FALLBACK_VERSION = '15.20.1';

export interface DDragon {
  version: string;
  champions: Record<string, string>;
  /** Numeric champion key (as in spectator data) → champion id. */
  byKey: Record<string, string>;
  items: Record<string, { name: string; legendary: boolean; boots: boolean }>;
}

const load = unstable_cache(
  async (): Promise<DDragon> => {
    try {
      const versions = (await (await fetch(`${CDN}/api/versions.json`, { cache: 'no-store' })).json()) as string[];
      const version = versions[0] ?? FALLBACK_VERSION;
      const data = (await (await fetch(`${CDN}/cdn/${version}/data/en_US/champion.json`, { cache: 'no-store' })).json()) as {
        data: Record<string, { id: string; key: string; name: string }>;
      };
      const champions: Record<string, string> = {};
      const byKey: Record<string, string> = {};
      for (const c of Object.values(data.data)) {
        champions[c.id] = c.name;
        byKey[c.key] = c.id;
      }
      const itemData = (await (await fetch(`${CDN}/cdn/${version}/data/en_US/item.json`, { cache: 'no-store' })).json()) as {
        data: Record<string, { name: string; gold: { total: number; purchasable: boolean }; into?: string[]; tags?: string[]; maps?: Record<string, boolean> }>;
      };
      const items: DDragon['items'] = {};
      for (const [id, it] of Object.entries(itemData.data)) {
        const boots = !!it.tags?.includes('Boots');
        // Finished items: nothing builds out of them, expensive, not consumables. Boots counted apart.
        const legendary = !boots && !it.into?.length && it.gold.total >= 2200 && !it.tags?.includes('Consumable');
        items[id] = { name: it.name, legendary, boots };
      }
      return { version, champions, byKey, items };
    } catch {
      return { version: FALLBACK_VERSION, champions: {}, byKey: {}, items: {} };
    }
  },
  ['ddragon-v3'],
  { revalidate: 86400 },
);

export async function ddragon() {
  const d = await load();
  return {
    version: d.version,
    championIdOf: (key: number) => d.byKey[String(key)] ?? null,
    championName: (id: string) => d.champions[id] ?? id.replace(/([a-z])([A-Z])/g, '$1 $2'),
    championImg: (id: string) => `${CDN}/cdn/${d.version}/img/champion/${id}.png`,
    item: (id: number) => d.items[String(id)] ?? null,
    itemImg: (id: number) => (id ? `${CDN}/cdn/${d.version}/img/item/${id}.png` : null),
    iconImg: (id: number) => `${CDN}/cdn/${d.version}/img/profileicon/${id}.png`,
  };
}
export type DD = Awaited<ReturnType<typeof ddragon>>;
