'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { levels, peaks, topo } from '@/lib/art';

const field = (seedPeaks: [number, number, number, number][], seed: number) => topo(600, 640, 40, 42, levels(12, 0.1, 0.075), peaks(600, 640, seedPeaks, seed, 0.8), 99).minor;

export function RateLimited({ retryAfterSec }: { retryAfterSec: number }) {
  const router = useRouter();
  const total = Math.max(1, retryAfterSec);
  const [sec, setSec] = useState(total);
  const art = useMemo(() => field([[0.8, 0.85, 0.28, 1.0], [0.15, 0.2, 0.25, 0.7]], 4.4), []);
  useEffect(() => {
    const id = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (sec === 0) router.refresh();
  }, [sec, router]);
  const label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return (
    <section className="panel rise" aria-label="Límite de peticiones" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <svg className="la" viewBox="0 0 600 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g>
          <path d={art} fill="none" style={{ stroke: 'var(--loss)' }} strokeOpacity=".2" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </g>
      </svg>
      <div style={{ position: 'absolute', width: 420, height: 400, right: -140, bottom: -150, background: 'var(--loss)', opacity: 0.13, animation: 'blob 12s ease-in-out infinite' }} aria-hidden="true" />
      <div style={{ position: 'relative' }}>
        <span className="eyebrow">Límite de peticiones</span>
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 20, padding: '16px 0' }}>
        <div style={{ position: 'relative', width: 168, height: 168 }}>
          <svg width="168" height="168" viewBox="0 0 168 168" fill="none" role="img" aria-label={`${sec} segundos para reintentar`}>
            <circle cx="84" cy="84" r="74" style={{ stroke: 'var(--line2)' }} strokeWidth="6" />
            <circle cx="84" cy="84" r="74" style={{ stroke: 'var(--loss)', transition: 'stroke-dashoffset 1s linear' }} strokeWidth="6" strokeLinecap="round" strokeDasharray="465" strokeDashoffset={(465 * (1 - sec / total)).toFixed(1)} transform="rotate(-90 84 84)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="d m" style={{ fontSize: 44, fontFamily: 'var(--fd)', color: 'var(--loss)' }}>{label}</div>
            <div className="eyebrow" style={{ marginTop: 6 }}>para reintentar</div>
          </div>
        </div>
        <h2 className="d" style={{ margin: 0, fontSize: 'clamp(30px, 3.4vw, 42px)' }}>
          Riot va con calma,
          <br />
          danos un momento.
        </h2>
        <p style={{ margin: 0, color: 'var(--tx2)', fontSize: 16, lineHeight: 1.55, maxWidth: 440 }}>
          Riot está limitando lo rápido que podemos leer partidas. Reintentaremos solos, y todo lo ya cargado se queda guardado.
        </p>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button className="btn" type="button" disabled={sec > 0} onClick={() => router.refresh()}>Reintentar ya</button>
        <Link className="btn2" href="/" style={{ height: 48 }}>Volver al inicio</Link>
      </div>
    </section>
  );
}

export function Message({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  const art = useMemo(() => field([[0.3, 0.7, 0.3, 1.0], [0.8, 0.2, 0.25, 0.8]], 2.7), []);
  return (
    <section className="panel rise" style={{ maxWidth: 760, margin: '0 auto', width: '100%', minHeight: 420 }}>
      <svg className="la" viewBox="0 0 600 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g>
          <path d={art} fill="none" style={{ stroke: 'var(--acc)' }} strokeOpacity=".18" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </g>
      </svg>
      <div style={{ position: 'relative' }}>
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 'clamp(30px, 3.4vw, 42px)' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--tx2)', fontSize: 16, lineHeight: 1.55, maxWidth: 480 }}>{body}</p>
      </div>
      <div style={{ position: 'relative' }}>
        <Link className="btn" href="/">Volver al inicio</Link>
      </div>
    </section>
  );
}
