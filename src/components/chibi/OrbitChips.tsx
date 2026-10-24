'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { capabilities } from '@/lib/chibi/graph';
import { phases } from '@/lib/chibi/timeline';

type Props = {
  /** Her sprite box: the orbit is sized and centred from it. */
  around: RefObject<HTMLElement | null>;
  progress: RefObject<number>;
  onPick: (id: string) => void;
  still?: boolean;
};

const SPEED = 0.22; // rad/s: one lap in about half a minute
const TILT = (-10 * Math.PI) / 180;

/**
 * Her capabilities as glass pills on a tilted ellipse around her. Chips on the
 * far half pass behind her (lower z-index, smaller, dimmer), so the ring reads
 * as 3D and never sits on her face. Each chip is a real button that opens its
 * node in the graph. One rAF loop moves them; hover or focus pauses it.
 * Reduced motion: fixed positions, no loop.
 */
export function OrbitChips({ around, progress, onPick, still = false }: Props) {
  const chips = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let angle = -Math.PI / 2;
    let paused = false;
    let last = 0;
    let raf = 0;

    const place = () => {
      const box = around.current?.getBoundingClientRect();
      const stage = around.current?.closest('.chibi-stage')?.getBoundingClientRect();
      if (!box || !stage) return;
      const hero = phases(progress.current ?? 0).hero;
      const cx = box.left - stage.left + box.width / 2;
      const cy = box.top - stage.top + box.height * 0.56;
      const narrow = stage.width < 640;
      // On wide screens the title sits to her right: the orbit stops short of it.
      const copy = around.current?.closest('.chibi-stage')?.querySelector('.chibi-hero-copy')?.getBoundingClientRect();
      const room = copy && stage.width >= 900 ? copy.left - stage.left - cx - 96 : stage.width / 2 - 16;
      const rx = Math.max(box.width * 0.55, Math.min(box.width * (narrow ? 0.62 : 0.8), room));
      const ry = box.height * 0.3;
      chips.current.forEach((el, i) => {
        if (!el) return;
        const a = angle + (2 * Math.PI * i) / capabilities.length;
        const ex = rx * Math.cos(a);
        const ey = ry * Math.sin(a);
        const x = cx + ex * Math.cos(TILT) - ey * Math.sin(TILT);
        const y = cy + ex * Math.sin(TILT) + ey * Math.cos(TILT);
        const front = Math.sin(a); // -1 far side .. 1 near side
        const depth = 0.5 + 0.5 * front;
        const half = el.offsetWidth / 2;
        const right = copy && stage.width >= 900 ? copy.left - stage.left - 12 : stage.width - 8;
        const left = Math.min(Math.max(x, half + 8), right - half);
        el.style.transform = `translate(${left}px, ${y}px) translate(-50%, -50%) scale(${0.84 + 0.16 * depth})`;
        el.style.opacity = String(hero * (0.55 + 0.45 * depth));
        el.style.zIndex = front > 0 ? '3' : '1';
        el.style.pointerEvents = hero > 0.5 ? 'auto' : 'none';
        el.tabIndex = hero > 0.5 ? 0 : -1;
      });
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!paused && !still) angle += dt * SPEED;
      place();
      raf = requestAnimationFrame(frame);
    };

    const pause = (on: boolean) => () => {
      paused = on;
    };
    const handlers = chips.current.map((el) => {
      const on = pause(true);
      const off = pause(false);
      el?.addEventListener('pointerenter', on);
      el?.addEventListener('pointerleave', off);
      el?.addEventListener('focus', on);
      el?.addEventListener('blur', off);
      return () => {
        el?.removeEventListener('pointerenter', on);
        el?.removeEventListener('pointerleave', off);
        el?.removeEventListener('focus', on);
        el?.removeEventListener('blur', off);
      };
    });

    if (still) {
      place();
      const ro = new ResizeObserver(place);
      if (around.current) ro.observe(around.current);
      return () => {
        ro.disconnect();
        handlers.forEach((h) => h());
      };
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      handlers.forEach((h) => h());
    };
  }, [around, progress, still]);

  return (
    <>
      {capabilities.map((c, i) => (
        <button
          key={c.id}
          ref={(el) => {
            chips.current[i] = el;
          }}
          type="button"
          className="chibi-cap"
          onClick={() => onPick(c.id)}
          aria-label={`${c.label}: open in the architecture`}
        >
          <span aria-hidden className="chibi-cap-glyph">
            {c.glyph}
          </span>
          <span className="chibi-cap-long">{c.label}</span>
          <span className="chibi-cap-short" aria-hidden>
            {c.short}
          </span>
        </button>
      ))}
    </>
  );
}
