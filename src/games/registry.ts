import 'server-only';
import { lol } from './lol';
import { tft } from './tft';
import type { GameModule } from './types';

/** Server-side game implementations. Register new games here and in catalog.ts. */
export const GAMES: GameModule[] = [lol, tft];

export const getGame = (id: string) => GAMES.find((g) => g.id === id.toLowerCase());
