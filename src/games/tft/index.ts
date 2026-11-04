import 'server-only';
import type { GameModule } from '../types';
import { tftMeta } from './meta';

export const tft: GameModule = { ...tftMeta };
