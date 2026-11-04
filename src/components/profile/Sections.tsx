'use client';

import { useState } from 'react';
import type { DistributionView, EntityTable, Feat, PerformanceView } from '@/core/types';
import { halftone } from '@/lib/format';
import { Radar } from '../charts';
import { Delta, DotBar, Portrait, Seg } from '../ui';

const toneColor = (t: 'up' | 'dn' | 'eq') => (t === 'up' ? 'var(--win)' : t === 'dn' ? 'var(--loss)' : 'var(--tx3)');

/** Radar + strengths/weaknesses, sharing one benchmark selector. */
export function Performance({ perf, playerName }: { perf: PerformanceView; playerName: string }) {
  const [bi, setBi] = useState(0);
  const bench = perf.benchmarks[bi];
  if (!bench) return null;
  return (
    <section id="performance" className="g12">
      <article className="card c5 rise" style={{ animationDelay: '100ms', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow">Rendimiento</div>
          <h2 className="h2" style={{ marginTop: 8 }}>Tú frente a la media</h2>
        </div>
        {perf.benchmarks.length > 1 && <Seg label="Comparar con" options={perf.benchmarks.map((b) => ({ label: b.button }))} value={bi} onChange={setBi} width={118} style={{ alignSelf: 'flex-start' }} />}
        <Radar axes={perf.axes} player={perf.player} bench={bench.radar} label={`Radar que compara ${perf.axes.join(', ')} con la media de ${bench.name}`} />
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--tx2)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundImage: halftone('var(--acc)', 1.6), backgroundSize: '5px 5px', border: '1.5px solid var(--acc)' }} />
            {playerName}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, borderTop: '2px dashed var(--tx)' }} />
            Media de {bench.name}{bench.provisional ? ' · provisional' : ''}
          </span>
        </div>
      </article>

      <article className="card c7 rise" style={{ animationDelay: '200ms', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div className="eyebrow">Puntos fuertes y débiles</div>
            <h2 className="h2" style={{ marginTop: 8 }}>Dónde ganas y pierdes rango</h2>
          </div>
          <span className="rk">Δ frente a la media de {bench.name}</span>
        </div>
        {bench.rows.map((r, i) => (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px 16px', padding: '14px 0', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{r.label}</div>
              <div className="m" style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3 }}>
                {r.value} vs {r.avg}
              </div>
            </div>
            <Delta text={r.delta} tone={r.tone} />
            <div style={{ gridColumn: '1 / -1' }}>
              <DotBar key={`${bench.id}-${r.label}`} pct={r.pct} tick={r.avgPct} color={toneColor(r.tone)} delay={300 + i * 90} />
            </div>
          </div>
        ))}
        <div className="m" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 2, height: 12, background: 'var(--tx)' }} />
          media de {bench.name} · más a la derecha es mejor
        </div>
      </article>
    </section>
  );
}

function FeatBadge({ f }: { f: Feat }) {
  const fs = f.mark.length >= 4 ? 12 : f.mark.length === 3 ? 13 : 16;
  return (
    <div className="badge">
      <svg className="hx" width="68" height="76" viewBox="0 0 68 76" aria-hidden="true">
        <polygon points="34,2 64,19 64,57 34,74 4,57 4,19" style={{ fill: f.color, stroke: f.color }} fillOpacity=".35" strokeWidth="1.6" />
        <polygon points="34,14 54,25 54,51 34,62 14,51 14,25" style={{ fill: 'var(--s2)', stroke: f.color }} strokeOpacity=".5" />
        <text x="34" y="43" textAnchor="middle" fontFamily="var(--fm)" fontWeight="700" fontSize={fs} style={{ fill: f.color }}>
          {f.mark}
        </text>
      </svg>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{f.title}</div>
        <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4, lineHeight: 1.35 }}>{f.sub}</div>
        <div className="m" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>{f.when}</div>
      </div>
    </div>
  );
}

export function Highlights({ feats, games }: { feats: Feat[]; games: number }) {
  if (!feats.length) return null;
  return (
    <section className="card rise" style={{ animationDelay: '100ms' }}>
      <div style={{ marginBottom: 22 }}>
        <div className="eyebrow">Destacados</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Logros de tus últimas {games} partidas</h2>
      </div>
      <div className="feats">
        {feats.map((f) => (
          <FeatBadge key={f.title} f={f} />
        ))}
      </div>
    </section>
  );
}

export function Entities({ table, dist }: { table: EntityTable; dist: DistributionView }) {
  return (
    <section id="champions" className="g12">
      <article className="card c8 rise" style={{ animationDelay: '100ms' }}>
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow">{table.eyebrow}</div>
          <h2 className="h2" style={{ marginTop: 8 }}>{table.title}</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Partidas</th>
                <th>% victorias</th>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                {table.badgeColumn && <th>{table.badgeColumn}</th>}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Portrait size={38} color={r.color} image={r.image} name={r.name} dot={1.4} border={1.5} inset={0.18} />
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                    </div>
                  </td>
                  <td className="m">{r.games}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="m" style={{ width: 44 }}>{r.winRate}%</span>
                      <div style={{ width: 90 }}>
                        <DotBar pct={r.winRate / 100} color={r.winRate >= 50 ? 'var(--win)' : 'var(--loss)'} />
                      </div>
                    </div>
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="m">{c}</td>
                  ))}
                  {r.badge && (
                    <td>
                      <Delta text={r.badge.text} tone={r.badge.tone} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <article className="card c4 rise" style={{ animationDelay: '200ms', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="eyebrow">{dist.eyebrow}</div>
          <h2 className="h2" style={{ marginTop: 8 }}>{dist.title}</h2>
        </div>
        <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', gap: 3 }}>
          {dist.items.map((r, i) => (
            <div key={r.name} className="grow" style={{ width: `${r.pct}%`, backgroundImage: halftone(r.color, 1.5), backgroundSize: '5px 5px', boxShadow: `inset 0 0 0 1px ${r.color}`, animationDelay: `${200 + i * 100}ms` }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {dist.items.map((r) => (
            <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: r.color }} />
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span className="m" style={{ color: 'var(--tx2)', fontSize: 13 }}>{r.games} p.</span>
              <span className="m" style={{ width: 44, textAlign: 'right' }}>{r.pct}%</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
