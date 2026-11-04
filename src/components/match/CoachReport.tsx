'use client';

import { CATEGORY_LABEL, type CompareRow, type Insight, type PostGameView } from '@/core/types';
import { halftone } from '@/lib/format';
import { GoldChart } from '../charts';
import { KillMap } from './KillMap';
import { Portrait } from '../ui';

const GRADE_COLOR: Record<PostGameView['grade'], string> = { S: 'var(--acc)', A: 'var(--win)', B: 'var(--t-plat)', C: 'var(--t-gold)', D: 'var(--loss)' };
const mmss = (min: number) => `${Math.floor(min)}:${String(Math.floor((min % 1) * 60)).padStart(2, '0')}`;
const toneColor = (t: CompareRow['tone']) => (t === 'up' ? 'var(--win-ink)' : t === 'dn' ? 'var(--loss-ink)' : 'var(--tx)');

/** The coach's breakdown of one game: verdict, what went well/wrong, what to practise, and the evidence. */
export function CoachReport({ a }: { a: PostGameView }) {
  const gc = GRADE_COLOR[a.grade];
  const goldDiff = a.series.gold.map(([me, op]) => me - op);
  return (
    <>
      <section className="card rise" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px 36px', borderColor: gc }}>
        <div aria-label={`Nota ${a.grade}`} style={{ position: 'relative', width: 120, height: 120, flex: 'none', display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: halftone(gc, 2.3), backgroundSize: '9px 9px', border: `2px solid ${gc}`, animation: 'blob 9s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: 'var(--s1)' }} />
          <span className="d" style={{ position: 'relative', fontSize: 52, color: gc }}>{a.grade}</span>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="eyebrow" style={{ color: gc }}>Informe del coach · {a.role}</div>
          <h2 className="d" style={{ margin: '10px 0 0', fontSize: 'clamp(22px, 2.6vw, 32px)', lineHeight: 1.15 }}>{a.headline}</h2>
          <p style={{ margin: '10px 0 0', color: 'var(--tx2)', fontSize: 14 }}>
            {a.baselineGames ? `Lo "normal en ti" son tus medias en tus últimas ${a.baselineGames} ranked.` : 'Juega algunas partidas más para tener comparaciones personales.'}
          </p>
        </div>
        {a.opponent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 20, background: 'var(--s2)' }}>
            <Portrait size={52} color="var(--loss)" image={a.opponent.image} name={a.opponent.champion} dot={1.4} inset={0.18} />
            <div>
              <div className="eyebrow">Rival de calle</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{a.opponent.champion}</div>
              <div className="m" style={{ fontSize: 12, color: 'var(--tx3)' }}>{a.opponent.name}</div>
            </div>
          </div>
        )}
      </section>

      <section className="grid2">
        <InsightList title="Lo que salió bien" eyebrow="Puntos fuertes" items={a.strengths} good empty="Ningún punto fuerte destacado en esta partida." />
        <InsightList title="Lo que salió mal" eyebrow="Errores" items={a.mistakes} empty="Nada importante: una partida limpia." />
      </section>

      {a.advice.length > 0 && (
        <section className="card rise">
          <div className="eyebrow" style={{ color: 'var(--acc)' }}>Cómo mejorar</div>
          <h2 className="h2" style={{ marginTop: 8 }}>Tu plan de práctica según esta partida</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 14, marginTop: 18 }}>
            {a.advice.map((ad) => (
              <div key={ad.id} style={{ padding: 20, borderRadius: 22, background: 'var(--s2)', border: '1px solid var(--line)' }}>
                <div className="eyebrow">{CATEGORY_LABEL[ad.category]}</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{ad.title}</div>
                <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 4 }}>{ad.why}</div>
                <ol style={{ margin: '12px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.45 }}>
                  {ad.how.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {a.laning.length > 0 && (
        <section className="grid2">
          <article className="card rise">
            <div className="eyebrow">Fase de líneas</div>
            <h2 className="h2" style={{ marginTop: 8 }}>Tú contra {a.opponent?.champion ?? 'tu rival'}</h2>
            <CompareTable rows={a.laning} otherLabel="Rival" />
          </article>
          {goldDiff.length > 2 && (
            <article className="card rise">
              <div className="eyebrow">Oro frente al rival de calle</div>
              <h2 className="h2" style={{ marginTop: 8 }}>Diferencia de oro en la calle</h2>
              <GoldChart series={goldDiff} width={560} height={200} step={7} animate />
              <div className="m" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)' }}>
                <span>0:00</span>
                <span>{goldDiff.length - 1}:00</span>
              </div>
            </article>
          )}
        </section>
      )}

      <section className="card rise">
        <div className="eyebrow">Mapa</div>
        <h2 className="h2" style={{ marginTop: 8 }}>{a.deaths.length ? `Muertes (${a.deaths.length}) y kills (${a.kills.length})` : `Sin muertes · ${a.kills.length} kills`}</h2>
        <KillMap deaths={a.deaths} kills={a.kills} image={a.mapImage} />
      </section>

      <section>
        <article className="card rise" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="eyebrow">Build</div>
            <h2 className="h2" style={{ marginTop: 8 }}>Tiempos de objetos</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
              {a.build.map((b, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }} title={b.name}>
                  {b.image && <img src={b.image} alt={b.name} width={40} height={40} style={{ borderRadius: 10, border: `1px solid ${b.kind === 'legendary' ? 'var(--acc)' : 'var(--line2)'}` }} />}
                  <span className="m" style={{ fontSize: 11, color: 'var(--tx2)' }}>{mmss(b.minute)}</span>
                </div>
              ))}
              {!a.build.length && <span style={{ color: 'var(--tx3)' }}>Ningún objeto completado.</span>}
            </div>
          </div>
          <div>
            <div className="eyebrow">Objetivos épicos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {a.objectives.map((o, i) => (
                <span key={i} className="rk" style={{ borderColor: o.good ? 'var(--win)' : 'var(--loss)', opacity: o.good && !o.involved ? 0.6 : 1 }} title={o.good ? (o.involved ? 'Tu equipo · participaste' : 'Tu equipo · sin ti') : o.youDead ? 'Rival · estabas muerto' : 'Rival'}>
                  {mmss(o.minute)} {o.label} {o.good ? (o.involved ? '✓' : '·') : o.youDead ? '☠' : '✗'}
                </span>
              ))}
              {!a.objectives.length && <span style={{ color: 'var(--tx3)' }}>Sin datos de la línea de tiempo.</span>}
            </div>
            <div className="m" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 10 }}>✓ conseguido contigo · · conseguido sin ti · ✗ rival · ☠ rival mientras estabas muerto</div>
          </div>
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 20 }}>
        {a.stats.map((g) => (
          <article key={g.group} className="card rise">
            <div className="eyebrow">{g.group}</div>
            <CompareTable rows={g.rows} otherLabel="Rival" />
          </article>
        ))}
      </section>
    </>
  );
}

function InsightList({ title, eyebrow, items, good, empty }: { title: string; eyebrow: string; items: Insight[]; good?: boolean; empty: string }) {
  const c = good ? 'var(--win)' : 'var(--loss)';
  return (
    <article className="card rise">
      <div className="eyebrow" style={{ color: c }}>{eyebrow}</div>
      <h2 className="h2" style={{ marginTop: 8 }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {items.map((it) => (
          <div key={it.id} style={{ padding: '14px 16px', borderRadius: 18, background: 'var(--s2)', borderLeft: `3px solid ${c}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700 }}>{it.title}</span>
              <span style={{ display: 'flex', gap: 3, flex: 'none' }} aria-label={`Impacto ${it.severity} de 3`}>
                {[1, 2, 3].map((k) => (
                  <span key={k} style={{ width: 7, height: 7, borderRadius: '50%', background: k <= it.severity ? c : 'var(--line2)' }} />
                ))}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 5, lineHeight: 1.45 }}>{it.detail}</div>
            <div className="m" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>
              {CATEGORY_LABEL[it.category]}
              {it.minute != null && ` · ${mmss(it.minute)}`}
            </div>
          </div>
        ))}
        {!items.length && <p style={{ margin: 0, color: 'var(--tx3)' }}>{empty}</p>}
      </div>
    </article>
  );
}

function CompareTable({ rows, otherLabel }: { rows: CompareRow[]; otherLabel: string }) {
  const hasUsual = rows.some((r) => r.usual != null);
  return (
    <table className="tbl" style={{ marginTop: 14 }}>
      <thead>
        <tr>
          <th />
          <th>Tú</th>
          <th>{otherLabel}</th>
          {hasUsual && <th>Lo normal en ti</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ whiteSpace: 'normal' }}>{r.label}</td>
            <td className="m" style={{ fontWeight: 700, color: toneColor(r.tone) }}>{r.you}</td>
            <td className="m" style={{ color: 'var(--tx2)' }}>{r.other ?? '—'}</td>
            {hasUsual && <td className="m" style={{ color: 'var(--tx3)' }}>{r.usual ?? '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
