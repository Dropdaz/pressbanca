import type { GameMeta } from '../types';
import { LOL_REGIONS } from '../lol/regions';

/**
 * Teamfight Tactics — next game on the roadmap. TFT shares Riot accounts and regions with LoL;
 * implementing it means a TftSource over tft-league-v1 / tft-match-v1 and mapping placements (1–8)
 * into the shared view models. Until then searches show the "coming soon" state.
 */
export const tftMeta: GameMeta = {
  id: 'tft',
  short: 'TFT',
  name: 'Teamfight Tactics',
  status: 'soon',
  regions: LOL_REGIONS.map(({ id, label }) => ({ id, label })),
  defaultRegion: 'EUW',
  idHint: 'Name#TAG',
};
