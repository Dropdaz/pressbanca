import type { GameMeta } from '../types';
import { LOL_REGIONS } from './regions';

export const lolMeta: GameMeta = {
  id: 'lol',
  short: 'LoL',
  name: 'League of Legends',
  status: 'live',
  regions: LOL_REGIONS.map(({ id, label }) => ({ id, label })),
  defaultRegion: 'EUW',
  idHint: 'Name#TAG',
};
