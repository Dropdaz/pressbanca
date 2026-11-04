'use client';

import { useId, useMemo } from 'react';
import { polyline } from '@/lib/art';
import { kShort } from '@/lib/format';

/** Gold lead over time: solid area above (ahead) / below (behind) a zero line. */
export function GoldChart({ series, width = 400, height = 130, line = 'var(--tx)', animate = false }: { series: number[]; width?: number; height?: number; step?: number; line?: string; animate?: boolean }) {
  const clip = usePatternId('gold');
  const g = useMemo(() => {
    if (series.length < 2) return null;
    const mid = height / 2;
    const max = Math.max(1000, ...series.map(Math.abs)) * 1.1;
    const y = (v: number) => mid - (v / max) * (mid - 4);
    const path = polyline(series.map((v, i) => [(i / (series.length - 1)) * width, y(v)]));
    const area = `${path}L${width} ${mid}L0 ${mid}Z`;
    return { path, area, mid, max };
  }, [series, width, height]);
  if (!g) return <div className="m" style={{ fontSize: 12, color: 'var(--tx3)', padding: 12 }}>Línea de tiempo no disponible para esta partida.</div>;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Diferencia de oro en el tiempo" style={{ display: 'block', marginTop: 8 }}>
      <defs>
        <clipPath id={`${clip}u`}><rect x="0" y="0" width={width} height={g.mid} /></clipPath>
        <clipPath id={`${clip}d`}><rect x="0" y={g.mid} width={width} height={height - g.mid} /></clipPath>
      </defs>
      <path d={g.area} clipPath={`url(#${clip}u)`} style={{ fill: 'var(--win)' }} fillOpacity=".45" />
      <path d={g.area} clipPath={`url(#${clip}d)`} style={{ fill: 'var(--loss)' }} fillOpacity=".45" />
      <path d={`M0 ${g.mid}H${width}`} style={{ stroke: 'var(--line2)' }} strokeDasharray="3 5" />
      <path d={g.path} fill="none" className={animate ? 'line-in' : undefined} style={{ stroke: line }} strokeWidth="1.8" strokeLinejoin="round" />
      <g style={{ fill: 'var(--tx3)', fontFamily: 'var(--fm)', fontSize: 10 }}>
        <text x="4" y="12">+{kShort(g.max / 1.1)}</text>
        <text x="4" y={height - 4}>−{kShort(g.max / 1.1)}</text>
      </g>
    </svg>
  );
}

export const peakLead = (series: number[]) => {
  const max = Math.max(0, ...series);
  const min = Math.min(0, ...series);
  return max >= -min ? { text: `máx. +${kShort(max)}`, up: true } : { text: `mín. −${kShort(-min)}`, up: false };
};

/** Cumulative damage of both teams; my team gets a solid fill under its line. */
export function DamageChart({ mine, theirs }: { mine: number[]; theirs: number[] }) {
  const W = 560, H = 220, B = 214;
  const g = useMemo(() => {
    if (mine.length < 2) return null;
    const mx = Math.max(mine[mine.length - 1], theirs[theirs.length - 1], 1) * 1.05;
    const y = (v: number) => B - (v / mx) * 200;
    const x = (i: number, n: number) => (i / (n - 1)) * W;
    const a = polyline(mine.map((v, i) => [x(i, mine.length), y(v)]));
    return { a, b: polyline(theirs.map((v, i) => [x(i, theirs.length), y(v)])), fill: `${a}L${W} ${B}L0 ${B}Z` };
  }, [mine, theirs]);
  if (!g) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daño acumulado de cada equipo durante la partida" style={{ display: 'block', marginTop: 18 }}>
      <path d={g.fill} style={{ fill: 'var(--win)' }} fillOpacity=".22" />
      <path d={g.b} fill="none" className="line-in" style={{ stroke: 'var(--loss)' }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d={g.a} fill="none" className="line-in" style={{ stroke: 'var(--win)' }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M0 ${B}H${W}`} style={{ stroke: 'var(--line2)' }} />
    </svg>
  );
}

const CX = 210, CY = 190, RR = 130;
const ang = (i: number, n: number) => ((-90 + (i * 360) / n) * Math.PI) / 180;
const pt = (i: number, v: number, n: number): [number, number] => [CX + ((RR * v) / 100) * Math.cos(ang(i, n)), CY + ((RR * v) / 100) * Math.sin(ang(i, n))];
const poly = (vals: number[]) => vals.map((v, i) => pt(i, v, vals.length).map((n) => n.toFixed(1)).join(',')).join(' ');

/** Six-axis radar: solid-filled player shape, dashed benchmark outline. */
export function Radar({ axes, player, bench, label }: { axes: string[]; player: number[]; bench?: number[]; label: string }) {
  const n = axes.length;
  const geo = useMemo(() => {
    const rings = [25, 50, 75, 100].map((v) => 'M' + axes.map((_, i) => pt(i, v, n).map((x) => x.toFixed(1)).join(' ')).join('L') + 'Z').join('');
    const spokes = axes.map((_, i) => `M${CX} ${CY}L${pt(i, 100, n).map((x) => x.toFixed(1)).join(' ')}`).join('');
    const labels = axes.map((a, i) => {
      const [x, y] = pt(i, 122, n);
      const cos = Math.cos(ang(i, n));
      return { a, x, y: y + 5, anchor: Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end' };
    });
    return { rings, spokes, labels };
  }, [axes, n]);
  return (
    <svg viewBox="-30 0 480 390" width="100%" role="img" aria-label={label} style={{ display: 'block', maxWidth: 460, margin: '0 auto' }}>
      <path d={geo.rings} fill="none" style={{ stroke: 'var(--line2)' }} strokeWidth="1" />
      <path d={geo.spokes} fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="1" />
      <g className="rin">
        <polygon points={poly(player)} style={{ fill: 'var(--acc)', stroke: 'var(--acc)' }} fillOpacity=".3" strokeWidth="2.2" strokeLinejoin="round" />
      </g>
      {bench && <polygon points={poly(bench)} fill="none" style={{ stroke: 'var(--tx)', transition: 'all .6s' }} strokeOpacity=".75" strokeWidth="1.8" strokeDasharray="5 5" strokeLinejoin="round" />}
      <g style={{ fill: 'var(--tx2)', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600 }}>
        {geo.labels.map((l) => (
          <text key={l.a} x={l.x} y={l.y} textAnchor={l.anchor as 'start' | 'middle' | 'end'}>
            {l.a}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** Stable unique id for SVG <pattern>s rendered many times. */
export const usePatternId = (prefix: string) => `${prefix}${useId().replace(/:/g, '')}`;
