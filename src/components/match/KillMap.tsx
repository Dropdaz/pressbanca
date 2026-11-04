'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { DeathView, KillView } from '@/core/types';
import { Seg } from '../ui';

/** Summoner's Rift in game units, and the SVG/image size it is drawn at. */
const S = 14870;
const V = 512;
const MIN_W = V / 6;

const KIND_LABEL: Record<DeathView['kind'], string> = { gank: 'Gank', solo: '1v1', caught: 'Pillado', teamfight: 'Teamfight', dive: 'Dive', skirmish: 'Escaramuza' };
const mmss = (min: number) => `${Math.floor(min)}:${String(Math.floor((min % 1) * 60)).padStart(2, '0')}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Ev = { id: string; minute: number; x: number; y: number } & ({ type: 'death'; n: number; d: DeathView } | { type: 'kill'; n: number; k: KillView });

/**
 * Zoomable kill map: wheel to zoom (at the cursor), drag to pan. Hover a marker for its minute;
 * click it to open the details in the side panel.
 */
export function KillMap({ deaths, kills, image }: { deaths: DeathView[]; kills: KillView[]; image: string | null }) {
  const [filter, setFilter] = useState(0); // 0 all · 1 deaths · 2 kills
  const [view, setView] = useState({ x: 0, y: 0, w: V });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null);

  const events = useMemo<Ev[]>(() => {
    const p = (x: number, y: number) => ({ x: (x / S) * V, y: V - (y / S) * V });
    const ds: Ev[] = deaths.map((d, i) => ({ id: `d${i}`, type: 'death', n: i + 1, d, minute: d.minute, ...p(d.x, d.y) }));
    const ks: Ev[] = kills.map((k, i) => ({ id: `k${i}`, type: 'kill', n: i + 1, k, minute: k.minute, ...p(k.x, k.y) }));
    return [...ds, ...ks].sort((a, b) => a.minute - b.minute);
  }, [deaths, kills]);
  const shown = events.filter((e) => filter === 0 || (filter === 1 ? e.type === 'death' : e.type === 'kill'));
  const [selId, setSelId] = useState<string | null>(() => (deaths.length ? 'd0' : kills.length ? 'k0' : null));
  const sel = events.find((e) => e.id === selId) ?? null;

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const v = viewRef.current;
      const px = v.x + ((e.clientX - r.left) / r.width) * v.w;
      const py = v.y + ((e.clientY - r.top) / r.height) * v.w;
      const w = clamp(v.w * (e.deltaY > 0 ? 1.18 : 1 / 1.18), MIN_W, V);
      setView({ w, x: clamp(px - (px - v.x) * (w / v.w), 0, V - w), y: clamp(py - (py - v.y) * (w / v.w), 0, V - w) });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const v = viewRef.current;
    const w = clamp(v.w * f, MIN_W, V);
    const cx = v.x + v.w / 2, cy = v.y + v.w / 2;
    setView({ w, x: clamp(cx - w / 2, 0, V - w), y: clamp(cy - w / 2, 0, V - w) });
  };
  const focus = (e: Ev) => {
    setSelId(e.id);
    const w = Math.min(viewRef.current.w, V / 2);
    setView({ w, x: clamp(e.x - w / 2, 0, V - w), y: clamp(e.y - w / 2, 0, V - w) });
  };

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const v = viewRef.current;
    setView({ w: v.w, x: clamp(d.vx - (dx / r.width) * v.w, 0, V - v.w), y: clamp(d.vy - (dy / r.height) * v.w, 0, V - v.w) });
  };
  const onUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };

  const k = view.w / V; // marker size stays constant on screen
  const R = 11 * k;
  const zoomed = view.w < V - 1;
  const hovered = events.find((e) => e.id === hover);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 18, marginTop: 16, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <Seg label="Mostrar" options={[{ label: 'Todo' }, { label: `Muertes ${deaths.length}` }, { label: `Kills ${kills.length}` }]} value={filter} onChange={setFilter} width={96} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn2" style={{ width: 40, padding: 0, justifyContent: 'center' }} onClick={() => zoomBy(1 / 1.5)} aria-label="Acercar">+</button>
            <button type="button" className="btn2" style={{ width: 40, padding: 0, justifyContent: 'center' }} onClick={() => zoomBy(1.5)} aria-label="Alejar">−</button>
            {zoomed && <button type="button" className="btn2" onClick={() => setView({ x: 0, y: 0, w: V })}>Ver todo</button>}
          </div>
        </div>
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
          width="100%"
          role="img"
          aria-label="Mapa de muertes y kills"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ display: 'block', aspectRatio: '1', borderRadius: 20, background: 'var(--s2)', cursor: zoomed ? 'grab' : 'zoom-in', touchAction: 'none', userSelect: 'none' }}
        >
          {image ? (
            <image href={image} x="0" y="0" width={V} height={V} preserveAspectRatio="none" style={{ opacity: 0.85 }} />
          ) : (
            <rect width={V} height={V} style={{ fill: 'var(--s2)' }} />
          )}
          <rect width={V} height={V} style={{ fill: 'var(--bg)' }} fillOpacity=".25" />
          {shown.map((e) => {
            const on = e.id === selId;
            const death = e.type === 'death';
            const c = death ? (e.d.objectiveLost ? 'var(--sc1)' : 'var(--loss)') : 'var(--win)';
            return (
              <g
                key={e.id}
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => setHover(e.id)}
                onPointerLeave={() => setHover((h) => (h === e.id ? null : h))}
                onClick={() => !drag.current?.moved && setSelId(e.id)}
              >
                {on && <circle cx={e.x} cy={e.y} r={R * 1.75} fill="none" style={{ stroke: c }} strokeWidth={2.5 * k} />}
                {death ? (
                  <circle cx={e.x} cy={e.y} r={R} style={{ fill: c, stroke: 'var(--s1)' }} strokeWidth={2 * k} />
                ) : (
                  <rect x={e.x - R * 0.85} y={e.y - R * 0.85} width={R * 1.7} height={R * 1.7} rx={3 * k} transform={`rotate(45 ${e.x} ${e.y})`} style={{ fill: e.k.role === 'kill' ? c : 'var(--s1)', stroke: c }} strokeWidth={2.2 * k} />
                )}
                <text x={e.x} y={e.y + 3.6 * k} textAnchor="middle" style={{ fill: death || e.k.role === 'kill' ? '#0b0d12' : 'var(--win)', fontFamily: 'var(--fm)', fontSize: 10 * k, fontWeight: 800, pointerEvents: 'none' }}>
                  {death ? e.n : e.k.role === 'kill' ? '⚔' : 'A'}
                </text>
              </g>
            );
          })}
          {hovered && (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={hovered.x - 34 * k} y={hovered.y - R - 30 * k} width={68 * k} height={24 * k} rx={7 * k} style={{ fill: 'var(--s1)', stroke: 'var(--line2)' }} strokeWidth={k} />
              <text x={hovered.x} y={hovered.y - R - 13.5 * k} textAnchor="middle" style={{ fill: 'var(--tx)', fontFamily: 'var(--fm)', fontSize: 11 * k, fontWeight: 700 }}>
                {mmss(hovered.minute)} · {hovered.type === 'death' ? 'muerte' : hovered.k.role === 'kill' ? 'kill' : 'asist.'}
              </text>
            </g>
          )}
        </svg>
        <div className="m" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--tx3)', marginTop: 8 }}>
          <span><span style={{ color: 'var(--loss)' }}>●</span> muerte</span>
          <span><span style={{ color: 'var(--sc1)' }}>●</span> muerte que regaló objetivo</span>
          <span><span style={{ color: 'var(--win)' }}>◆</span> kill</span>
          <span><span style={{ color: 'var(--win)' }}>◇</span> asistencia</span>
          <span>Rueda para zoom · arrastra para moverte</span>
        </div>
      </div>

      <EventPanel ev={sel} events={shown} onPick={focus} />
    </div>
  );
}

function EventPanel({ ev, events, onPick }: { ev: Ev | null; events: Ev[]; onPick: (e: Ev) => void }) {
  const idx = ev ? events.findIndex((e) => e.id === ev.id) : -1;
  const step = (d: number) => {
    if (!events.length) return;
    const next = events[(idx + d + events.length) % events.length];
    onPick(next);
  };
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 22, background: 'var(--s2)', border: '1px solid var(--line)', minHeight: 300 }}>
      {!ev ? (
        <p style={{ margin: 0, color: 'var(--tx3)' }}>Haz clic en un marcador del mapa para ver qué pasó.</p>
      ) : ev.type === 'death' ? (
        <>
          <PanelHead color="var(--loss)" kicker={`Muerte #${ev.n}`} minute={ev.minute} chip={KIND_LABEL[ev.d.kind]} />
          <People label="Te mataron" people={ev.d.killers} color="var(--loss)" />
          <Facts
            rows={[
              ['Zona', ev.d.zone],
              ['Aliados cerca', ev.d.alliesNear === 0 ? 'Ninguno' : String(ev.d.alliesNear)],
              ...(ev.d.objectiveLost ? ([['Objetivo perdido', ev.d.objectiveLost]] as [string, string][]) : []),
              ...(ev.d.bounty > 0 ? ([['Recompensa dada', `${ev.d.bounty} de oro`]] as [string, string][]) : []),
            ]}
          />
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)' }}>{ev.d.note}</p>
        </>
      ) : (
        <>
          <PanelHead color="var(--win)" kicker={ev.k.role === 'kill' ? 'Kill' : 'Asistencia'} minute={ev.minute} chip={ev.k.with.length ? `${ev.k.with.length + 1} vs 1` : 'En solitario'} />
          <People label="Víctima" people={[ev.k.victim]} color="var(--loss)" />
          {ev.k.with.length > 0 && <People label="Con" people={ev.k.with} color="var(--win)" />}
          <Facts rows={[['Zona', ev.k.zone], ...(ev.k.bounty > 0 ? ([['Recompensa', `${ev.k.bounty} de oro`]] as [string, string][]) : [])]} />
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)' }}>{ev.k.note}</p>
        </>
      )}
      {events.length > 1 && (
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="eyebrow">Cronología</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn2" style={{ height: 32 }} onClick={() => step(-1)} aria-label="Anterior">←</button>
              <button type="button" className="btn2" style={{ height: 32 }} onClick={() => step(1)} aria-label="Siguiente">→</button>
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {events.map((e) => {
              const c = e.type === 'death' ? 'var(--loss)' : 'var(--win)';
              const on = ev?.id === e.id;
              return (
                <button key={e.id} type="button" onClick={() => onPick(e)} className="m" style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 8, color: on ? 'var(--bg)' : c, background: on ? c : `color-mix(in srgb, ${c} 14%, transparent)` }}>
                  {mmss(e.minute)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function PanelHead({ color, kicker, minute, chip }: { color: string; kicker: string; minute: number; chip: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
      <div>
        <div className="eyebrow" style={{ color }}>{kicker}</div>
        <div className="d m" style={{ fontFamily: 'var(--fd)', fontSize: 34, marginTop: 4 }}>{mmss(minute)}</div>
      </div>
      <span className="rk" style={{ borderColor: color, color }}>{chip}</span>
    </div>
  );
}

function People({ label, people, color }: { label: string; people: { champion: string; image: string | null }[]; color: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {people.map((p, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 999, background: 'var(--s1)', border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}>
            {p.image && <img src={p.image} alt="" width={30} height={30} style={{ borderRadius: '50%' }} />}
            <span style={{ fontWeight: 600, fontSize: 14 }}>{p.champion}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--s1)' }}>
          <div className="eyebrow" style={{ fontSize: 10 }}>{k}</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
