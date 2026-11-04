/**
 * Generative SVG helpers behind the visual language: topographic contour lines (marching squares
 * over a scalar field) and halftone dot fields. Pure functions returning SVG path data.
 */

export type Field = (x: number, y: number) => number;
type Pt = [number, number];

const SEGMENTS: Record<number, [number, number][]> = {
  // edges: 0 = top, 1 = right, 2 = bottom, 3 = left
  1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 3], [2, 1]], 6: [[0, 2]], 7: [[0, 3]],
  8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]],
};

/** Contour lines of `fn` at each level. Levels where `k % every === 0` go to `major`. */
export function topo(w: number, h: number, cols: number, rows: number, levels: number[], fn: Field, every = 4) {
  const dx = w / cols, dy = h / rows;
  const g: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    const r: number[] = [];
    for (let i = 0; i <= cols; i++) r.push(fn(i * dx, j * dy));
    g.push(r);
  }
  let minor = '', major = '';
  levels.forEach((L, k) => {
    let d = '';
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = g[j][i], b = g[j][i + 1], c = g[j + 1][i + 1], e = g[j + 1][i];
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (e > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * dx, y = j * dy, t = (p: number, q: number) => (L - p) / (q - p);
        const edge: Pt[] = [
          [x + t(a, b) * dx, y],
          [x + dx, y + t(b, c) * dy],
          [x + t(e, c) * dx, y + dy],
          [x, y + t(a, e) * dy],
        ];
        for (const [p, q] of SEGMENTS[idx]) d += `M${Math.round(edge[p][0])} ${Math.round(edge[p][1])}L${Math.round(edge[q][0])} ${Math.round(edge[q][1])}`;
      }
    if (k % every === 0) major += d;
    else minor += d;
  });
  return { minor, major };
}

/** Sum of gaussian peaks `[cx, cy, spread, height]` (cx/cy as 0–1 fractions) plus soft ripples. */
export function peaks(w: number, h: number, ps: [number, number, number, number][], seed: number, ripple = 1): Field {
  return (x, y) => {
    let v = 0;
    for (const p of ps) {
      const dx = x / w - p[0], dy = (y - p[1] * h) / w;
      v += p[3] * Math.exp(-(dx * dx + dy * dy) / (2 * p[2] * p[2]));
    }
    return v + ripple * (0.06 * Math.sin(x * 0.011 + seed) * Math.cos(y * 0.014 + seed * 1.4) + 0.04 * Math.sin((x + y) * 0.019 + seed * 2.1));
  };
}

export const levels = (n: number, from: number, step: number) => Array.from({ length: n }, (_, i) => from + i * step);

/** Halftone: staggered dots inside a box, radius ∝ fn(x, y) ∈ [0, 1]. */
export function dots(x0: number, y0: number, x1: number, y1: number, step: number, fn: Field, maxR: number) {
  let d = '';
  for (let y = y0 + step / 2, j = 0; y < y1; y += step, j++) {
    const off = j % 2 ? step / 2 : 0;
    for (let x = x0 + step / 2 + off; x < x1; x += step) {
      const v = fn(x, y);
      if (v < 0.07) continue;
      const r = Math.min(maxR, v * maxR);
      const rs = r.toFixed(2), r2 = (2 * r).toFixed(2);
      d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${rs} ${rs} 0 1 0 ${r2} 0a${rs} ${rs} 0 1 0 -${r2} 0`;
    }
  }
  return d;
}

export function inPoly(pts: Pt[], x: number, y: number) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/** Linear interpolation of a series sampled at equal x steps. */
export function sampleAt(series: number[], x: number, width: number) {
  if (series.length < 2) return series[0] ?? 0;
  const f = (x / width) * (series.length - 1);
  const i = Math.min(series.length - 2, Math.max(0, Math.floor(f)));
  const t = f - i;
  return series[i] * (1 - t) + series[i + 1] * t;
}

export const polyline = (pts: Pt[]) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
