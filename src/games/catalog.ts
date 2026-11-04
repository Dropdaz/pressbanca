import { lolMeta } from './lol/meta';
import { tftMeta } from './tft/meta';
import type { GameMeta } from './types';

/** Client-safe list of games (metadata only), in tab order. */
export const CATALOG: GameMeta[] = [lolMeta, tftMeta];
export const getGameMeta = (id: string) => CATALOG.find((g) => g.id === id.toLowerCase());
