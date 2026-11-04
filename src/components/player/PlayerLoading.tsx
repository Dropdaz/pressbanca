'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ApiStatus } from '../ApiStatus';

const PARTS = ['Partidas de la temporada', 'Campeones', 'Rango y rivales', 'MMR estimado', 'Análisis del coach'];

/** Shown while a profile (all tabs at once) or a game breakdown renders on the server. */
export function PlayerLoading() {
  const pathname = usePathname();
  const match = pathname.includes('/match/');
  const [t0] = useState(() => Date.now());
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [t0]);
  return (
    <section className="card rise" aria-busy="true" style={{ minHeight: 'min(60vh, 520px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: '48px 24px' }}>
      <span className="blobL" style={{ width: 56, height: 56 }} />
      <div>
        <div className="eyebrow" style={{ color: 'var(--acc)' }}>{match ? 'Análisis de partida' : 'Cargando perfil'}</div>
        <h2 className="d" style={{ margin: '10px 0 0', fontSize: 'clamp(24px, 3vw, 36px)' }}>{match ? 'Leyendo la partida…' : 'Preparando todas las pestañas…'}</h2>
        <p style={{ margin: '10px auto 0', color: 'var(--tx2)', maxWidth: 460, lineHeight: 1.5 }}>
          {match ? 'Línea de tiempo, rangos de la partida e informe del coach.' : 'Todo se carga una vez, así que después cambiar de pestaña es instantáneo.'}
        </p>
      </div>
      {!match && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 520 }}>
          {PARTS.map((p, i) => (
            <span key={p} className="m" style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--line2)', color: 'var(--tx2)', animation: `chipPulse 1.6s ease-in-out ${i * 0.2}s infinite` }}>{p}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="m" style={{ fontSize: 12, color: 'var(--tx3)', fontVariantNumeric: 'tabular-nums' }}>{s}s</span>
        <ApiStatus />
      </div>
      {s >= 20 && <p style={{ margin: 0, fontSize: 13, color: 'var(--tx3)', maxWidth: 420 }}>Está tardando un poco: se están pidiendo a Riot datos que aún no estaban guardados, respetando el límite de la API.</p>}
    </section>
  );
}
