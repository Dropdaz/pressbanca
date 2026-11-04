export const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
export const signed = (n: number, digits = 0) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;
export const kShort = (n: number) => `${(n / 1000).toFixed(1)}k`;

export function duration(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

export function timeAgo(ts: number, now = Date.now()) {
  const min = (now - ts) / 60_000;
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `hace ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Colour for a 0–10 performance score: red → amber → blue → teal → gold. */
export const scoreColor = (s: number) => (s >= 8.5 ? 'var(--sc5)' : s >= 7 ? 'var(--sc4)' : s >= 5.5 ? 'var(--sc3)' : s >= 4 ? 'var(--sc2)' : 'var(--sc1)');

export const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();

/** Solid fill as a background-image (was a halftone dot pattern; kept as a helper so callers stay simple). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const halftone = (color: string, _r?: number) => `linear-gradient(${color}, ${color})`;
