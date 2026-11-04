'use client';

import { useMemo } from 'react';
import type { LadderTier, MmrView, RankLabel, ReachView, ShownRank } from '@/core/types';
import { levels, polyline, topo } from '@/lib/art';
import { fmt, halftone } from '@/lib/format';

/** Hidden-MMR hero card: big number, confidence gauge, shown → estimated, 80% range on the tier strip. */
export function MmrCard({ mmr, shown, ladder, e }: { mmr: MmrView; shown: ShownRank | null; ladder: LadderTier[]; e: number }) {
  const color = mmr.estimated.color;

  // Three tiers around the estimate for the range strip.
  const asc = [...ladder].sort((a, b) => a.min - b.min);
  const at = Math.max(0, asc.findIndex((t) => mmr.value >= t.min && mmr.value < t.max));
  const from = Math.min(Math.max(0, at - 1), asc.length - 3);
  const strip = asc.slice(from, from + 3);
  const lo = strip[0].min, span = strip[2].max - lo;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  const delta = mmr.divisionsDelta;

  return (
    <article className="card mmr c7 rise" style={{ animationDelay: '100ms', display: 'flex', flexDirection: 'column', gap: 22, minHeight: 600 }}>
      <div className="mblob" aria-hidden="true" style={{ background: color }} />
      <div className="mblob b2" aria-hidden="true" style={{ borderColor: color }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="eyebrow" style={{ color }}>MMR estimado</div>
        <span className="rk" style={{ background: 'var(--ov)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)' }} />
          {mmr.lobbiesRead} partidas analizadas{shown ? ` · ${shown.seasonGames} de temporada` : ''}
        </span>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="d m big" style={{ fontFamily: 'var(--fd)', fontSize: 88, letterSpacing: '-.05em', lineHeight: 0.95 }}>{fmt(mmr.value * e)}</div>
          {mmr.trendWindow >= 4 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ stroke: mmr.trend >= 0 ? 'var(--win)' : 'var(--loss)', transform: mmr.trend >= 0 ? undefined : 'scaleY(-1)' }} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17L17 5M8 5h9v9" />
              </svg>
              <span className="m" style={{ fontSize: 15, color: mmr.trend >= 0 ? 'var(--win)' : 'var(--loss)', fontWeight: 700 }}>
                {mmr.trend >= 0 ? '+' : '−'}{fmt(Math.abs(mmr.trend) * e)}
              </span>
              <span style={{ fontSize: 14, color: 'var(--tx2)' }}>MMR en tus últimas {mmr.trendWindow} partidas</span>
            </div>
          )}
        </div>
        <svg width="108" height="108" viewBox="0 0 108 108" fill="none" role="img" aria-label={`Confianza ${mmr.confidence} por ciento`} style={{ flex: 'none' }}>
          <circle cx="54" cy="54" r="46" style={{ stroke: 'var(--line2)' }} strokeWidth="6" />
          <circle cx="54" cy="54" r="46" style={{ stroke: 'var(--acc)' }} strokeWidth="6" strokeLinecap="round" strokeDasharray="289" strokeDashoffset={(289 * (1 - (mmr.confidence / 100) * e)).toFixed(1)} transform="rotate(-90 54 54)" />
          <text x="54" y="58" textAnchor="middle" style={{ fill: 'var(--tx)', fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 24 }}>{Math.round(mmr.confidence * e)}%</text>
          <text x="54" y="76" textAnchor="middle" style={{ fill: 'var(--tx3)', fontFamily: 'var(--fm)', fontSize: 9, letterSpacing: '.14em' }}>CONFIANZA</text>
        </svg>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '16px 18px', borderRadius: 20, background: 'var(--ov)', border: '1px solid var(--line2)' }}>
        <div>
          <div className="eyebrow">Visible</div>
          <div className="d" style={{ fontSize: 20, color: shown?.color ?? 'var(--tx2)', marginTop: 4 }}>{shown?.label ?? 'Sin rango'}</div>
        </div>
        <svg width="40" height="14" viewBox="0 0 40 14" fill="none" aria-hidden="true" style={{ stroke: 'var(--tx3)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7h34M30 2l6 5-6 5" />
        </svg>
        <div>
          <div className="eyebrow">Estimado</div>
          <div className="d" style={{ fontSize: 20, color, marginTop: 4 }}>{mmr.estimated.label}</div>
        </div>
        {delta != null && (
          <span className={`dl ${delta >= 0.5 ? 'up' : delta <= -0.5 ? 'dn' : 'eq'}`} style={{ marginLeft: 'auto' }}>
            {Math.abs(delta) < 0.5 ? 'Coincide con tu rango' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} división${Math.abs(delta) === 1 ? '' : 'es'}`}
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="eyebrow">Rango con 80% de confianza</span>
          <span className="m" style={{ fontSize: 13, color: 'var(--tx2)' }}>{fmt(mmr.lo * e)} – {fmt(mmr.hi * e)}</span>
        </div>
        <div style={{ position: 'relative', height: 44, marginTop: 8 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 17, height: 10, borderRadius: 5, display: 'flex', overflow: 'hidden', opacity: 0.5 }}>
            {strip.map((t) => (
              <div key={t.name} style={{ width: `${((t.max - t.min) / span) * 100}%`, background: t.color }} />
            ))}
          </div>
          <div className="grow" style={{ position: 'absolute', left: `${pos(mmr.lo)}%`, width: `${pos(mmr.hi) - pos(mmr.lo)}%`, top: 9, height: 26, borderRadius: 13, background: 'var(--hl)', border: '1.5px solid var(--tx)', animationDelay: '.5s' }} />
          {shown && <div title="Rango visible" style={{ position: 'absolute', left: `${pos(shown.rating)}%`, top: 11, height: 22, width: 2, background: shown.color }} />}
          <div title="Estimación" style={{ position: 'absolute', left: `${pos(mmr.value)}%`, top: 3, height: 38, width: 4, marginLeft: -2, borderRadius: 2, background: 'var(--acc)' }} />
        </div>
        <div className="m" style={{ display: 'flex', fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
          {strip.map((t) => (
            <span key={t.name} style={{ width: `${((t.max - t.min) / span) * 100}%` }}>{t.name}</span>
          ))}
        </div>
      </div>

      <p style={{ position: 'relative', margin: 'auto 0 0', fontSize: 18, lineHeight: 1.45, fontWeight: 500 }}>
        {mmr.verdict.before}
        <span style={{ color: mmr.verdict.color, fontWeight: 700 }}>{mmr.verdict.highlight}</span>
        {mmr.verdict.after}
      </p>
    </article>
  );
}

/** Tier ladder with VISIBLE / TÚ / ALCANZABLE markers. */
export function LadderCard({ ladder, shown, mmr, reach }: { ladder: LadderTier[]; shown: ShownRank | null; mmr: MmrView; reach: ReachView }) {
  const marks = [
    shown && { v: shown.rating, tag: `VISIBLE · ${shown.short}`, color: shown.color },
    { v: mmr.value, tag: `TÚ · ${mmr.estimated.short} · ${fmt(mmr.value)}`, color: mmr.estimated.color },
    { v: reach.target, tag: `ALCANZABLE · ${reach.rank.short}`, color: reach.rank.color },
  ].filter(Boolean) as { v: number; tag: string; color: string }[];
  const inTier = (t: LadderTier, v: number) => v >= t.min && (v < t.max || t === ladder[0]);
  return (
    <article className="card c5 rise" style={{ animationDelay: '160ms', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="eyebrow">Escala de MMR</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Qué significa tu MMR</h2>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, color: 'var(--tx2)' }}>Cada división ocupa 100 de MMR. Riot nunca muestra este número, así que esta es la escala en la que lo situamos.</p>
      </div>
      {ladder.map((t) => {
        const ms = marks.filter((m) => inTier(t, m.v));
        const on = inTier(t, mmr.value);
        return (
          <div key={t.name} className={`lad${on ? ' on' : ''}`} style={{ ['--lad' as string]: t.color }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundImage: halftone(t.color, 1.5), backgroundSize: '5px 5px', border: `1.5px solid ${t.color}` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: t.color }}>{t.name}</div>
              <div className="m" style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 2 }}>{t.rangeLabel}</div>
              {ms.map((m) => (
                <span key={m.tag} className="m" style={{ display: 'inline-block', marginTop: 6, marginRight: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', padding: '3px 9px', borderRadius: 999, color: 'var(--bg)', background: m.color }}>
                  {m.tag}
                </span>
              ))}
            </div>
            <div style={{ position: 'relative', height: 10, borderRadius: 5, backgroundImage: halftone(t.color, 1.4), backgroundSize: '5px 5px', boxShadow: `inset 0 0 0 1px ${t.color}`, opacity: ms.length ? 1 : 0.55 }}>
              {ms.map((m) => (
                <span key={m.tag} style={{ position: 'absolute', top: -6, width: 4, height: 22, marginLeft: -2, borderRadius: 2, background: 'var(--tx)', left: `${Math.min(100, ((m.v - t.min) / (t.max - t.min)) * 100)}%`, boxShadow: `0 0 0 3px ${m.color}` }} />
              ))}
            </div>
          </div>
        );
      })}
    </article>
  );
}

/** Topographic climb chart: MMR history as a line across contour lines, projection cone to the reachable contour. */
export function ClimbCard({ mmr, reach, scale }: { mmr: MmrView; reach: ReachView; scale: RankLabel[] }) {
  const chart = useMemo(() => {
    const h = mmr.history.length ? mmr.history : [mmr.value];
    const vals = [...h, mmr.lo, reach.target, reach.hi];
    let yMin = Math.floor((Math.min(...vals) - 80) / 100) * 100;
    let yMax = Math.ceil((Math.max(...vals) + 80) / 100) * 100;
    if (yMax - yMin < 400) {
      const pad = (400 - (yMax - yMin)) / 2;
      yMin = Math.floor((yMin - pad) / 100) * 100;
      yMax = Math.ceil((yMax + pad) / 100) * 100;
    }
    const span = yMax - yMin;
    const ym = (v: number) => 360 - ((v - yMin) / span) * 320;
    const nowY = ym(mmr.value);
    const reachY = ym(reach.target);
    const fld = (x: number, y: number) => {
      const e = (360 - y) / 320, dx = (x - 440) / 62, dy = (y - nowY) / 46, dx2 = (x - 150) / 90, dy2 = (y - 300) / 40;
      return e + 0.06 * Math.exp(-(dx * dx + dy * dy)) + 0.03 * Math.exp(-(dx2 * dx2 + dy2 * dy2)) + 0.012 * Math.sin(x * 0.02 + y * 0.015) + 0.008 * Math.sin(x * 0.05 - y * 0.03);
    };
    const contour = topo(760, 400, 76, 40, levels(Math.floor(span / 50) + 2, 0, 50 / span), fld, 2);
    const reachLine = topo(760, 400, 76, 40, [(reach.target - yMin) / span], fld, 1).major;
    const pts: [number, number][] = h.map((v, i) => [h.length === 1 ? 440 : 40 + (i / (h.length - 1)) * 400, ym(v)]);
    const sm = pts.map((p, i) => (i === pts.length - 1 || i === 0 ? p : ([p[0], (pts[i - 1][1] + p[1] * 2 + pts[i + 1][1]) / 4] as [number, number])));
    const ss = (t: number) => t * t * (3 - 2 * t);
    const upY = ym(reach.hi), loY = ym(reach.lo);
    const up = (x: number) => nowY + (upY - nowY) * ss((x - 440) / 280);
    const lo = (x: number) => nowY + (loY - nowY) * ss((x - 440) / 280);
    const mid = (x: number) => nowY + (reachY - nowY) * ss((x - 440) / 280);
    let cone = `M440 ${nowY}`, proj = `M440 ${nowY}`;
    for (let x = 440; x <= 720; x += 14) cone += `L${x} ${up(x).toFixed(1)}`;
    for (let x = 720; x >= 440; x -= 14) cone += `L${x} ${lo(x).toFixed(1)}`;
    cone += 'Z';
    for (let x = 454; x <= 720; x += 14) proj += `L${x} ${mid(x).toFixed(1)}`;
    const step = span > 900 ? 400 : 100;
    const ticks = scale.filter((s) => s.rating > yMin && s.rating < yMax && s.rating % step === 0).map((s) => ({ ...s, top: (ym(s.rating) / 4).toFixed(2) + '%' }));
    return { contour, reachLine, hist: polyline(sm), cone, proj, nowY, reachY, ticks };
  }, [mmr, reach, scale]);

  return (
    <article className="card c12 rise" style={{ animationDelay: '200ms', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Rango alcanzable</div>
          <h2 className="h2" style={{ marginTop: 8 }}>Proyección de subida</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="d" style={{ fontSize: 30, color: reach.rank.color }}>{reach.rank.label}</div>
          <div className="m" style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 4 }}>{fmt(reach.target)} MMR · rango {reach.rangeLabel}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 84px' }}>
        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 760 400" width="100%" role="img" aria-label={`Gráfica del MMR estimado en las últimas ${mmr.history.length} partidas y la subida proyectada hacia ${reach.rank.label}`} style={{ display: 'block', aspectRatio: '760 / 400' }}>
            {/* Static on purpose: drifting contours would misalign with the reach contour and repaint the chart. */}
            <g>
              <path d={chart.contour.minor} fill="none" style={{ stroke: 'var(--tx3)' }} strokeOpacity=".3" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              <path d={chart.contour.major} fill="none" style={{ stroke: 'var(--tx2)' }} strokeOpacity=".5" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </g>
            <path d={chart.reachLine} fill="none" className="climb" style={{ stroke: reach.rank.color }} strokeWidth="2.4" strokeLinecap="round" />
            <path d={chart.cone} style={{ fill: reach.rank.color }} fillOpacity=".22" />
            <path d={chart.hist} fill="none" className="line-in" style={{ stroke: 'var(--acc)' }} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={chart.proj} fill="none" style={{ stroke: 'var(--tx)' }} strokeOpacity=".8" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
            <circle className="pulse" cx="440" cy={chart.nowY} r="12" fill="none" style={{ stroke: 'var(--acc)' }} strokeWidth="1.6" />
            <circle cx="440" cy={chart.nowY} r="7" style={{ fill: 'var(--acc)', stroke: 'var(--s1)' }} strokeWidth="3" />
            <circle cx="720" cy={chart.reachY} r="6" style={{ fill: reach.rank.color, stroke: 'var(--s1)' }} strokeWidth="3" />
          </svg>
          <div className="m" style={{ position: 'absolute', left: '53%', top: `${(chart.nowY / 400) * 100 + 4}%`, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: 'var(--acc)', background: 'var(--ov)', padding: '4px 10px', borderRadius: 999, border: '1px solid var(--acc)' }}>
            TÚ · {fmt(mmr.value)}
          </div>
          <div className="m" style={{ position: 'absolute', right: '1%', top: `${Math.max(0, (chart.reachY / 400) * 100 - 12)}%`, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: reach.rank.color, background: 'var(--ov)', padding: '4px 10px', borderRadius: 999, border: `1px solid ${reach.rank.color}` }}>
            ALCANZABLE · {fmt(reach.target)}
          </div>
        </div>
        <div style={{ position: 'relative' }} aria-hidden="true">
          {chart.ticks.map((r) => (
            <div key={r.rating} className="m" style={{ position: 'absolute', left: 12, top: r.top, transform: 'translateY(-50%)', fontSize: 11, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 6, background: r.color }} />
              {r.short}
            </div>
          ))}
        </div>
      </div>
      <div className="m" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', letterSpacing: '.08em', paddingRight: 84 }}>
        <span>−{mmr.history.length} PARTIDAS</span>
        <span>AHORA</span>
        <span>+{reach.games} PARTIDAS · PROYECCIÓN</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="stat-tile">
          <div className="eyebrow">Probabilidad de lograrlo</div>
          <div className="d m" style={{ fontSize: 26, marginTop: 6 }}>{reach.probability}%</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Partidas necesarias</div>
          <div className="d m" style={{ fontSize: 26, marginTop: 6 }}>~{reach.games}</div>
        </div>
        <div className="stat-tile">
          <div className="eyebrow">Lo que te frena</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>{reach.heldBackBy}</div>
        </div>
      </div>
    </article>
  );
}
