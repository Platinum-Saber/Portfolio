'use client';

import { useEffect, useSyncExternalStore, type RefObject } from 'react';

/**
 * Scroll progress through a tall section, 0 when its top reaches the top of the
 * viewport and 1 when its bottom reaches the bottom.
 *
 * It calls `onFrame` (at most once per animation frame) instead of setting
 * state: the story moves a canvas camera, CSS variables and a core on every
 * frame, and routing that through React renders would cost far more than the
 * work itself. A plain rAF-throttled scroll listener; the site deliberately
 * has no scroll library.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onFrame: (p: number) => void,
  enabled = true,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      onFrame(run > 0 ? Math.min(1, Math.max(0, -rect.top / run)) : 0);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ref, onFrame, enabled]);
}

const QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** `prefers-reduced-motion`, hydration-safe (false on the server). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** 0 before `a`, 1 after `b`, smoothstep between. */
export function ramp(p: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
