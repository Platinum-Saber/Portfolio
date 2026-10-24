'use client';

import { useEffect, useRef, type RefObject } from 'react';
import manifest from '../../../public/images/raphael/manifest.json';
import { beat, phases, voiceLevel } from '@/lib/chibi/timeline';

/**
 * Raphael as her desktop overlay draws her on the `svg-rig` branch: the
 * casual-coat image pack, animated by swapping drawings rather than by a rig
 * (Chibi-Agent chibi_overlay/sprites.py). scripts/sync-raphael.mjs cuts the
 * pack into one full base plus small patches; this stacks them as plain
 * <img>s, so the page needs no WebGL and no animation library.
 *
 * - Blink: every 2-6 s, half -> closed -> half (the overlay's BLINK_S).
 * - Gaze: the pointer's direction from her eyes picks one of eight drawings,
 *   by the nearest 45-degree sector outside a dead zone, and a new direction
 *   must hold 120 ms before her eyes switch (the overlay's GAZE_HOLD_S).
 * - Wave once on load; the thinking face while the core thinks; mouth shapes
 *   while it "speaks" (the same made-up level as the core: no audio here).
 *
 * The scroll zoom is CSS (.chibi-sprite reads --zoom): the source is 1536 px
 * tall, enough for the zoom it gets.
 */

type Rect = { src: string; x: number; y: number; w: number; h: number };
const M = manifest as unknown as {
  canvas: [number, number];
  base: string;
  wave: { src: string; dx: number; dy: number };
  eyeCentre: [number, number];
  deadzone: number;
  patches: Record<string, Rect>;
  gaze: { name: string; x: number; y: number; eyes: Rect[] }[];
};
const ROOT = '/images/raphael/';
const [CW, CH] = M.canvas;
const BLINK_S = 0.14;
const GAZE_HOLD_S = 0.12;
const WAVE_S = 1.6;

const pct = (r: Pick<Rect, 'x' | 'y' | 'w' | 'h'>) => ({
  left: `${(r.x / CW) * 100}%`,
  top: `${(r.y / CH) * 100}%`,
  width: `${(r.w / CW) * 100}%`,
  height: `${(r.h / CH) * 100}%`,
});

type Props = {
  progress: RefObject<number>;
  /** Base image only: no blink, gaze, wave or talking (reduced motion). */
  still?: boolean;
  className?: string;
};

export function SpriteStage({ progress, still = false, className }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || still) return;
    // A layer can be several <img>s (a gaze direction is two eye patches).
    const layers = (key: string) => el.querySelectorAll<HTMLElement>(`[data-layer="${key}"]`);
    const shown = new Map<string, boolean>();
    const show = (key: string, on: boolean) => {
      if (shown.get(key) === on) return;
      shown.set(key, on);
      for (const l of layers(key)) l.style.opacity = on ? '1' : '0';
    };

    let pointer: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const start = performance.now() / 1000;
    let nextBlink = start + 2 + Math.random() * 4;
    let gaze = '';
    let pending = '';
    let pendingSince = 0;
    let raf = 0;
    let visible = true;

    const pickGaze = (): string => {
      if (!pointer) return '';
      const r = el.getBoundingClientRect();
      const cx = r.left + (M.eyeCentre[0] / CW) * r.width;
      const cy = r.top + (M.eyeCentre[1] / CH) * r.height;
      // Normalised so the dead zone means "about at her face" at any size.
      const dx = (pointer.x - cx) / (r.width * 0.9);
      const dy = (cy - pointer.y) / (r.height * 0.6);
      if (Math.hypot(dx, dy) < M.deadzone) return '';
      const a = Math.atan2(dy, dx);
      let best = '';
      let bestD = Infinity;
      for (const g of M.gaze) {
        const d = Math.abs(Math.atan2(Math.sin(a - Math.atan2(g.y, g.x)), Math.cos(a - Math.atan2(g.y, g.x))));
        if (d < bestD) {
          bestD = d;
          best = g.name;
        }
      }
      return best;
    };

    const frame = () => {
      const t = performance.now() / 1000;
      const ph = phases(progress.current ?? 0);
      const b = beat(ph);
      const waving = t - start < WAVE_S && ph.zoom < 0.05;

      // Blink, unless she is waving (the wave is a separate drawing).
      if (t > nextBlink + BLINK_S) nextBlink = t + 2 + Math.random() * 4;
      const bt = t - nextBlink;
      const blink = bt < 0 || waving ? '' : bt < BLINK_S / 3 || bt > (2 * BLINK_S) / 3 ? 'blink_half' : 'blink_closed';

      // Gaze, held a moment before switching so a sector edge never flickers.
      const want = pickGaze();
      if (want !== pending) {
        pending = want;
        pendingSince = t;
      } else if (pending !== gaze && t - pendingSince > GAZE_HOLD_S) {
        gaze = pending;
      }

      const lv = b === 'speaking' ? voiceLevel(t) : 0;
      const mouth = b !== 'speaking' ? '' : lv > 0.62 ? 'mouth_3' : lv > 0.46 ? 'mouth_2' : lv > 0.34 ? 'mouth_1' : '';
      const thinking = b === 'thinking';

      show('wave', waving);
      show('base', !waving);
      show('thinking', !waving && thinking);
      show('blink_half', !waving && !thinking && blink === 'blink_half');
      show('blink_closed', !waving && !thinking && blink === 'blink_closed');
      for (const k of ['mouth_1', 'mouth_2', 'mouth_3']) show(k, !waving && mouth === k);
      for (const g of M.gaze) show(`gaze_${g.name}`, !waving && !thinking && !blink && gaze === g.name);

      raf = visible && ph.her > 0.001 ? requestAnimationFrame(frame) : 0;
    };

    // Runs only while she is on screen; scrolling back (or into view) resumes it.
    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      wake();
    });
    io.observe(el);
    window.addEventListener('scroll', wake, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('scroll', wake);
      window.removeEventListener('pointermove', onMove);
    };
  }, [progress, still]);

  const img = (layer: string, r: Rect, key = layer) => (
    // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimiser
    <img
      key={key}
      data-layer={layer}
      src={ROOT + r.src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className="chibi-sprite-layer"
      style={{ ...pct(r), opacity: 0 }}
    />
  );

  const wave = { src: M.wave.src, x: M.wave.dx, y: M.wave.dy, w: CW, h: CH };
  return (
    <div ref={host} className={`chibi-sprite ${className ?? ''}`} style={{ aspectRatio: `${CW} / ${CH}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimiser */}
      <img
        data-layer="base"
        src={ROOT + M.base}
        alt="Raphael, a chibi with long light-blue hair, gold eyes and a navy coat with a fur scarf"
        draggable={false}
        className="chibi-sprite-layer"
        style={{ inset: 0, width: '100%', height: '100%' }}
      />
      {!still && (
        <>
          {img('wave', wave)}
          {Object.entries(M.patches).map(([k, r]) => img(k, r))}
          {M.gaze.map((g) => g.eyes.map((r, i) => img(`gaze_${g.name}`, r, `gaze_${g.name}_${i}`)))}
        </>
      )}
    </div>
  );
}
