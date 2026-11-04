'use client';

import { useEffect, useState } from 'react';

/** 0 → 1 eased (cubic out) over `ms` after mount, for count-ups and gauges. Instant with reduced motion. */
export function useIntro(ms = 1600) {
  const [e, setE] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setE(1);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      setE(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms]);
  return e;
}

/** Re-render periodically so relative times ("5 min ago") stay fresh, and avoid SSR mismatch. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
