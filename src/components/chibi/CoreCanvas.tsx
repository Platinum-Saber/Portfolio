'use client';

import { useEffect, useRef } from 'react';
import { CoreFX, type CoreInput } from '@/lib/chibi/coreFx';

type Props = {
  /**
   * Read every frame, so the parent can drive the core from scroll progress or
   * hover without re-rendering React 60 times a second.
   */
  drive: (dt: number) => CoreInput;
  /** Cage radius as a fraction of the canvas's shorter side. */
  radius?: number;
  /** Extra backing-store scale while the graph is zoomed in, so it stays sharp. */
  resolution?: number;
  /** Draw one settled frame and stop: no animation loop at all. */
  still?: boolean;
  className?: string;
};

/**
 * The thinking core on a 2D canvas (no WebGL needed, so it also runs where the
 * Live2D stage can't). The animation loop only runs while the canvas is on
 * screen.
 */
export function CoreCanvas({ drive, radius = 0.26, resolution = 1, still = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const driveRef = useRef(drive);
  useEffect(() => {
    driveRef.current = drive;
  }, [drive]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const fx = new CoreFX();
    let raf = 0;
    let last = 0;
    let visible = true;

    const size = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * resolution;
      const w = Math.round(canvas.clientWidth * scale);
      const h = Math.round(canvas.clientHeight * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    const draw = () => {
      size();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fx.paint(ctx, canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * radius);
    };
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      fx.update(dt, driveRef.current(dt));
      draw();
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    if (still) {
      fx.settle(driveRef.current(0));
      draw();
      const ro = new ResizeObserver(draw);
      ro.observe(canvas);
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [radius, resolution, still]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
