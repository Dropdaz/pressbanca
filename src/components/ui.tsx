'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { initial, scoreColor } from '@/lib/format';

export function Logo({ size = 38, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <Link href="/" aria-label="Inicio de PressBanca" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="18.5" style={{ stroke: 'var(--acc)' }} strokeWidth="1.5" />
        <path d="M5 24 C9 14 15 12 20 14 S31 12 35 18" style={{ stroke: 'var(--acc)' }} strokeWidth="1.5" />
        <path d="M9 30 C13 22 18 21 22 22 S30 21 33 25" style={{ stroke: 'var(--acc)' }} strokeWidth="1.5" />
        <circle cx="22" cy="9" r="3" style={{ fill: 'var(--acc)' }} />
      </svg>
      <span className={`d${compact ? ' hide-s' : ''}`} style={{ fontSize: size * 0.5, letterSpacing: '-.04em' }}>
        PRESS<span style={{ color: 'var(--acc)' }}>BANCA</span>
      </span>
    </Link>
  );
}

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.classList.contains('light')), []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle('light', next);
    try {
      localStorage.setItem('pb-theme', next ? 'light' : 'dark');
    } catch {
      /* storage blocked */
    }
  };
  return (
    <button className="tgl" type="button" onClick={toggle} aria-label={light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'} aria-pressed={light}>
      <i>
        <svg className="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        </svg>
        <svg className="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </i>
    </button>
  );
}

/** Sets the accent palette for the current game on <html>. */
export function GameAccent({ game }: { game: string }) {
  useEffect(() => {
    document.documentElement.dataset.game = game;
  }, [game]);
  return null;
}

export interface SegOption {
  label: ReactNode;
  disabled?: boolean;
}

/** Segmented control whose selection is a gooey liquid blob (two blobs, staggered). */
export function Seg({
  options,
  value,
  onChange,
  width,
  label,
  className = 'seg',
  btnClass = 'sg',
  style,
}: {
  options: SegOption[];
  value: number;
  onChange: (i: number) => void;
  width?: number;
  label: string;
  className?: string;
  btnClass?: string;
  style?: CSSProperties;
}) {
  const w = 100 / options.length;
  return (
    <div className={className} role="group" aria-label={label} style={style}>
      <div className="goo" style={{ opacity: value < 0 ? 0 : 1 }}>
        <div className="gb a" style={{ left: `${Math.max(0, value) * w}%`, width: `${w}%` }} />
        <div className="gb b" style={{ left: `${Math.max(0, value) * w}%`, width: `${w}%` }} />
      </div>
      {options.map((o, i) => (
        <button key={i} type="button" className={`${btnClass}${i === value ? ' on' : ''}`} disabled={o.disabled} aria-pressed={i === value} onClick={() => onChange(i)} style={width ? { width } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Round portrait: the image fills the circle inside a rank-coloured ring; without an image, a solid disc with the initial. */
export function Portrait({
  size,
  color,
  image,
  name,
  dot = 1.6,
  grid = 5,
  inset = 0.19,
  border = 2,
  fontSize,
  children,
}: {
  size: number;
  color: string;
  image?: string | null;
  name: string;
  dot?: number;
  grid?: number;
  inset?: number;
  border?: number;
  fontSize?: number;
  children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const hasImg = Boolean(image && !broken);
  // A thin gap between ring and image on big portraits; small ones use every pixel for the image.
  const gap = size >= 48 ? Math.round(size * 0.04) : 0;
  const inner = hasImg ? size - 2 * border - 2 * gap : size - 2 * Math.round(size * inset);
  void dot;
  void grid;
  return (
    <div className={`por${hasImg ? ' has-img' : ''}`} style={{ width: size, height: size, color, background: hasImg ? 'var(--s1)' : color, border: `${border}px solid ${color}`, fontSize: fontSize ?? size * 0.3 }}>
      <span style={{ width: inner, height: inner }}>{hasImg && image ? <img src={image} alt="" onError={() => setBroken(true)} /> : initial(name)}</span>
      {children}
    </div>
  );
}

export function Items({ items, size = 30 }: { items: (string | null)[]; size?: number }) {
  return (
    <>
      {items.map((src, i) => (
        <span key={i} className={`sq${src ? '' : ' empty'}`} style={{ width: size, height: size }}>
          {src ? <img src={src} alt="" loading="lazy" /> : null}
        </span>
      ))}
    </>
  );
}

/** Score pill coloured by rating; `—` for remakes. */
export function Score({ value, size = 15, style }: { value: number | null; size?: number; style?: CSSProperties }) {
  if (value == null) return <span className="score" style={{ ['--c' as string]: 'var(--tx3)', fontSize: size, ...style }}>—</span>;
  return (
    <span className="score" style={{ ['--c' as string]: scoreColor(value), fontSize: size, ...style }} title={`Nota ${value.toFixed(1)} de 10`}>
      {value.toFixed(1)}
    </span>
  );
}

export function Delta({ text, tone, style }: { text: string; tone: 'up' | 'dn' | 'eq'; style?: CSSProperties }) {
  return (
    <span className={`dl ${tone}`} style={style}>
      {text}
    </span>
  );
}

/** Solid progress bar with an optional benchmark tick. */
export function DotBar({ pct, color, tick, delay, height }: { pct: number; color: string; tick?: number; delay?: number; height?: number }) {
  return (
    <div className="bar" style={height ? { height } : undefined}>
      <div className="barf grow" style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: color, animationDelay: delay ? `${delay}ms` : undefined }} />
      {tick != null && <div className="tick" style={{ left: `${tick * 100}%` }} />}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="demo">
      <span className="m" style={{ fontWeight: 700, color: 'var(--acc)' }}>DATOS DE DEMO</span>
      <span>
        Sin <code className="m">RIOT_API_KEY</code> configurada: los datos son generados.
      </span>
    </div>
  );
}
