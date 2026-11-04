'use client';

import { useMemo } from 'react';
import type { MatchDetailView } from '@/core/types';
import { levels, peaks, topo } from '@/lib/art';
import { duration, halftone, kShort, timeAgo, scoreColor } from '@/lib/format';
import { useIntro, useNow } from '@/lib/hooks';
import { DamageChart, GoldChart, peakLead } from '../charts';
import { DotBar, Items, Portrait } from '../ui';


export function MatchDetail({ d, children }: { d: MatchDetailView; children?: React.ReactNode }) {
  const e = useIntro(1500);
  const now = useNow();
  const color = d.win ? 'var(--win)' : 'var(--loss)';
  const art = useMemo(() => topo(1280, 360, 64, 22, levels(12, 0.1, 0.075), peaks(1280, 360, [[0.2, 0.9, 0.2, 0.9], [0.78, 0.3, 0.17, 1.0]], 5.1), 4), []);
  const maxDmg = Math.max(1, ...d.teams.flatMap((t) => t.players.map((p) => p.damage)));
  const lead = peakLead(d.gold);
  const minutes = d.durationSec / 60;

  return (
    <>
      <div className="m" style={{ fontSize: 13, color: 'var(--tx2)', textAlign: 'right' }}>
        {d.queue} · {duration(d.durationSec)}{now ? ` · ${timeAgo(d.endedAt, now)}` : ''}
      </div>
        <section className="card rise" style={{ padding: 0, minHeight: 360 }}>
          <svg className="la" viewBox="0 0 1280 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <g>
              <path d={art.minor} fill="none" style={{ stroke: color }} strokeOpacity=".2" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              <path d={art.major} fill="none" style={{ stroke: color }} strokeOpacity=".55" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </g>
          </svg>
          <div className="blobv" style={{ width: 520, height: 480, left: -140, bottom: -220, background: color }} aria-hidden="true" />
          <div className="profile-head" style={{ position: 'relative', padding: 36, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '28px 44px' }}>
            <Portrait size={148} color={color} image={d.image} name={d.champion} dot={2.4} grid={9} inset={0.19} fontSize={42} />
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div className="eyebrow" style={{ color }}>
                {d.win ? 'Victoria' : 'Derrota'} · {d.champion}
                {d.role && ` · ${d.role}`}
              </div>
              <div className="d big" style={{ fontSize: 'clamp(52px, 7vw, 96px)', color, marginTop: 8, letterSpacing: '-.05em' }}>{d.win ? 'VICTORIA' : 'DERROTA'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '26px 36px', marginTop: 20 }}>
                <div>
                  <div className="eyebrow">KDA</div>
                  <div className="m" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                    {d.k} <span style={{ color: 'var(--tx3)' }}>/</span> <span style={{ color: 'var(--loss)' }}>{d.d}</span> <span style={{ color: 'var(--tx3)' }}>/</span> {d.a}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Participación en kills</div>
                  <div className="m" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{d.killParticipation}%</div>
                </div>
                <div>
                  <div className="eyebrow">CS</div>
                  <div className="m" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                    {d.cs} <span style={{ fontSize: 14, color: 'var(--tx2)', fontWeight: 400 }}>{(d.cs / minutes).toFixed(1)}/min</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '22px 26px', borderRadius: 26, background: 'var(--ov)', border: '1px solid var(--line2)' }}>
              <svg width="124" height="124" viewBox="0 0 124 124" fill="none" role="img" aria-label={`Nota de rendimiento ${d.score} sobre 10`}>
                <circle cx="62" cy="62" r="54" style={{ stroke: 'var(--line2)' }} strokeWidth="8" />
                <circle cx="62" cy="62" r="54" style={{ stroke: scoreColor(d.score) }} strokeWidth="8" strokeLinecap="round" strokeDasharray="339.3" strokeDashoffset={(339.3 * (1 - (d.score / 10) * e)).toFixed(1)} transform="rotate(-90 62 62)" />
                <text x="62" y="70" textAnchor="middle" style={{ fill: scoreColor(d.score), fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 34, letterSpacing: '-.04em' }}>{(d.score * e).toFixed(1)}</text>
              </svg>
              <div>
                <div className="eyebrow">Nota de rendimiento</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{d.scoreNote}</div>
                <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4, maxWidth: 180, lineHeight: 1.4 }}>Comparada con los otros nueve jugadores de la partida.</div>
              </div>
            </div>
          </div>
        </section>

        {children}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
          {d.lobby.map((l, i) => {
            const c = l.rank?.color ?? 'var(--tx3)';
            return (
              <div key={l.label} className="card rise" style={{ padding: '22px 26px', animationDelay: `${i * 80}ms`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div className="eyebrow">{l.label}</div>
                  <div className="d" style={{ fontSize: 26, marginTop: 8, color: c }}>{l.rank?.label ?? 'Sin rango'}</div>
                </div>
                <div style={{ width: 54, height: 54, borderRadius: '50%', backgroundImage: halftone(c, 1.6), backgroundSize: '7px 7px', border: `1.5px solid ${c}` }} />
              </div>
            );
          })}
        </section>

        {d.teams.map((t, ti) => {
          const tc = t.win ? 'var(--win)' : 'var(--loss)';
          return (
            <section key={t.name} className="card rise" style={{ animationDelay: `${ti * 100}ms` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                  <h2 className="h2" style={{ color: tc }}>{t.name}</h2>
                  <span className="m" style={{ fontSize: 13, color: 'var(--tx2)' }}>
                    {t.kills} kills · {kShort(t.gold)} de oro · {t.objectives}
                  </span>
                </div>
                {t.avgRank && <span className="rk" style={{ color: t.avgRank.color, borderColor: t.avgRank.color }}>Media {t.avgRank.short}</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 940 }}>
                  <div className="pr" style={{ paddingTop: 0, paddingBottom: 8 }}>
                    {['Jugador', 'KDA', 'Daño', 'Oro', 'CS', 'Vis', 'Objetos', 'Nota'].map((h) => (
                      <span key={h} className="ph">{h}</span>
                    ))}
                  </div>
                  {t.players.map((p, i) => (
                    <div key={p.name + p.champion} className={`pr${p.me ? ' me' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <Portrait size={40} color={tc} image={p.image} name={p.champion} dot={1.3} border={1.5} inset={0.17} fontSize={14} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
                            {p.champion} · <span style={{ color: p.rank?.color ?? 'var(--tx3)' }}>{p.rank?.short ?? 'Sin rango'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="m" style={{ fontWeight: 700 }}>{p.k}/{p.d}/{p.a}</div>
                      <div>
                        <DotBar pct={p.damage / maxDmg} color={tc} delay={300 + i * 90} height={9} />
                        <div className="m" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>{kShort(p.damage)}</div>
                      </div>
                      <div className="m" style={{ color: 'var(--tx2)', fontSize: 14 }}>{kShort(p.gold)}</div>
                      <div className="m" style={{ color: 'var(--tx2)', fontSize: 14 }}>{p.cs}</div>
                      <div className="m" style={{ color: 'var(--tx2)', fontSize: 14 }}>{p.vision}</div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <Items items={p.items} size={26} />
                      </div>
                      <div className="d m" style={{ fontSize: 18, fontFamily: 'var(--fd)', color: scoreColor(p.score) }}>{p.score.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        {d.gold.length > 1 && (
          <section className="grid2">
            <article className="card rise">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">Diferencia de oro</div>
                  <h2 className="h2" style={{ marginTop: 8 }}>Ventaja de tu equipo en el tiempo</h2>
                </div>
                <span className={`dl ${lead.up ? 'up' : 'dn'}`}>{lead.text}</span>
              </div>
              <GoldChart series={d.gold} width={560} height={220} step={7} animate />
              <Axis minutes={minutes} />
            </article>
            <article className="card rise" style={{ animationDelay: '100ms' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">Daño a campeones</div>
                  <h2 className="h2" style={{ marginTop: 8 }}>Acumulado por equipo</h2>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--tx2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 3, background: 'var(--win)' }} />
                    Tu equipo {kShort(d.damage.mine.at(-1) ?? 0)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 3, background: 'var(--loss)' }} />
                    Rival {kShort(d.damage.theirs.at(-1) ?? 0)}
                  </span>
                </div>
              </div>
              <DamageChart mine={d.damage.mine} theirs={d.damage.theirs} />
              <Axis minutes={minutes} />
            </article>
          </section>
        )}

        <section className="grid2">
          {d.events.length > 0 && (
            <article className="card rise">
              <div className="eyebrow">Momentos clave</div>
              <h2 className="h2" style={{ marginTop: 8 }}>Línea de tiempo</h2>
              <div style={{ position: 'relative', height: 150, margin: '26px 30px 0' }}>
                <div style={{ position: 'absolute', left: -30, right: -30, top: 74, height: 2, background: 'var(--line2)' }} />
                {placeEvents(d.events, minutes).map(({ ev, up }, i) => {
                  return (
                    <div key={i} style={{ position: 'absolute', left: `${(ev.minute / minutes) * 100}%`, top: up ? 0 : 80, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 84, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 600, order: up ? 0 : 2 }}>{ev.label}</div>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: ev.good ? 'var(--win)' : 'var(--loss)', boxShadow: '0 0 0 4px var(--s1)', order: 1 }} />
                      <div className="m" style={{ fontSize: 10, color: 'var(--tx3)', order: up ? 2 : 0 }}>{duration(Math.round(ev.minute * 60))}</div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}
          <article className="card rise" style={{ animationDelay: '100ms' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Desglose de la nota</div>
                <h2 className="h2" style={{ marginTop: 8 }}>De dónde sale el {d.score.toFixed(1)}</h2>
              </div>
              <span className="rk">Δ frente a la mediana</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
              {d.breakdown.map((r, i) => {
                const diff = r.value - r.avg;
                const tone = diff >= 0.5 ? 'up' : diff <= -0.5 ? 'dn' : 'eq';
                const c = tone === 'up' ? 'var(--win)' : tone === 'dn' ? 'var(--loss)' : 'var(--tx3)';
                return (
                  <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 40px 66px', gap: 14, alignItems: 'center', padding: '11px 0', borderTop: '1px solid var(--line)' }}>
                    <span style={{ fontWeight: 600 }}>{r.label}</span>
                    <DotBar pct={r.value / 10} tick={r.avg / 10} color={c} delay={300 + i * 90} />
                    <span className="m" style={{ fontWeight: 700 }}>{(r.value * e).toFixed(1)}</span>
                    <span className={`dl ${tone}`} style={{ textAlign: 'center' }}>
                      {diff >= 0 ? '+' : '−'}
                      {Math.abs(diff).toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
    </>
  );
}

/** Put each moment above or below the line, on whichever side has more room since its last label. */
function placeEvents(events: MatchDetailView['events'], minutes: number) {
  const last = { up: -Infinity, down: -Infinity };
  return events.map((ev) => {
    const x = (ev.minute / minutes) * 100;
    const up = x - last.up >= x - last.down;
    last[up ? 'up' : 'down'] = x;
    return { ev, up };
  });
}

function Axis({ minutes }: { minutes: number }) {
  const marks = [0, 10, 20, 30, 40].filter((m) => m <= minutes);
  return (
    <div className="m" style={{ position: 'relative', height: 14, fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
      {marks.map((m) => (
        <span key={m} style={{ position: 'absolute', left: `${(m / minutes) * 100}%`, transform: m === 0 ? undefined : 'translateX(-50%)' }}>
          {m}:00
        </span>
      ))}
    </div>
  );
}
