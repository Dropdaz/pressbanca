import type { InsightCategory } from '@/core/types';

/**
 * Generic names for the insights the post-game analysis produces (src/games/lol/analysis.ts), so the
 * same pattern can be grouped across games. `bad` is the name as a mistake, `good` as a strength.
 */
export const INSIGHT_NAMES: Record<string, { bad?: string; good?: string }> = {
  cs10: { bad: 'Por detrás en CS al minuto 10', good: 'Ventaja de CS al minuto 10' },
  'cs10-usual': { bad: 'Farmeo por debajo de tu nivel' },
  gold15: { bad: 'Por detrás en oro al minuto 15', good: 'Por delante en oro al minuto 15' },
  plates: { bad: 'Pierdes placas en tu calle' },
  'early-deaths': { bad: 'Mueres antes del minuto 14' },
  ganked: { bad: 'Te gankean una y otra vez' },
  'solo-deaths': { bad: 'Pierdes los 1v1' },
  caught: { bad: 'Te pillan solo por el mapa' },
  'death-objective': { bad: 'Tus muertes regalan objetivos' },
  survival: { good: 'Casi no mueres' },
  'time-dead': { bad: 'Pasas mucho tiempo muerto' },
  shutdown: { bad: 'Regalas shutdowns' },
  objectives: { bad: 'No apareces en los objetivos', good: 'Siempre estás en los objetivos' },
  'midgame-farm': { bad: 'El farmeo cae tras la fase de líneas' },
  farm: { good: 'Farmeas muy bien' },
  unspent: { bad: 'Acumulas oro sin gastar' },
  'first-item': { bad: 'Tu primer objeto llega tarde', good: 'Primer objeto rápido' },
  vision: { bad: 'Poca visión', good: 'Gran control de visión' },
  'no-control': { bad: 'No compras wards de control' },
  kp: { bad: 'Te pierdes las peleas', good: 'Estás en todas las peleas' },
  damage: { bad: 'Poco daño para tu rol', good: 'Cargas con el daño del equipo' },
  positioning: { bad: 'Recibes más daño del que haces' },
  'solo-kills': { good: 'Ganas tus 1v1' },
  multi: { good: 'Multikills' },
  dodge: { good: 'Esquivas muchas habilidades' },
};

export const insightName = (id: string, good: boolean, fallback: string) => (good ? INSIGHT_NAMES[id]?.good : INSIGHT_NAMES[id]?.bad) ?? fallback;

/** Which mistakes each piece of advice comes from (to show real examples under the advice). */
export const ADVICE_SOURCES: Record<string, string[]> = {
  'track-jungler': ['ganked'],
  trading: ['solo-deaths'],
  'mid-game-positioning': ['caught'],
  'objective-setup': ['death-objective'],
  'mid-game-farm': ['midgame-farm'],
  vision: ['vision', 'no-control'],
  'join-fights': ['kp'],
  positioning: ['positioning'],
  'cs-drill': ['cs10', 'cs10-usual'],
  'early-safety': ['early-deaths'],
  recalls: ['first-item', 'unspent'],
};

export const CATEGORY_COLOR: Record<InsightCategory, string> = {
  Laning: 'var(--t-plat)',
  Deaths: 'var(--loss)',
  Objectives: 'var(--t-master)',
  Vision: 'var(--t-gold)',
  Farming: 'var(--t-emerald)',
  Fighting: 'var(--t-gm)',
  Economy: 'var(--t-chall)',
  Build: 'var(--t-diamond)',
};
