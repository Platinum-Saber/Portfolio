'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  arrow,
  contourImage,
  fmt,
  palette,
  setupCanvas,
  toPx,
  type View,
} from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

type Prob = {
  label: string;
  f: (x: number, y: number) => number;
  g: (x: number, y: number) => [number, number];
  r: number;
  span: number;
};
const PROBS: Record<string, Prob> = {
  saddle: {
    label: 'f = x₁² − x₂² on x₁² + x₂² = 16',
    f: (x, y) => x * x - y * y,
    g: (x, y) => [2 * x, -2 * y],
    r: 4,
    span: 6,
  },
  shift: {
    label: 'f = (x₁ − 3)² + (x₂ − 2)² on x₁² + x₂² = 4',
    f: (x, y) => (x - 3) ** 2 + (y - 2) ** 2,
    g: (x, y) => [2 * (x - 3), 2 * (y - 2)],
    r: 2,
    span: 5,
  },
};

export function LagrangeLab() {
  const [id, setId] = useState('saddle');
  const p = PROBS[id];
  const [deg, setDeg] = useState(30);
  const th = (deg * Math.PI) / 180;
  const x = p.r * Math.cos(th),
    y = p.r * Math.sin(th);
  const [gx, gy] = p.g(x, y);
  const [hx, hy] = [2 * x, 2 * y];
  // Parallel test: the tangential component of ∇f (tangent t = (−sin θ, cos θ)).
  const tang = -gx * Math.sin(th) + gy * Math.cos(th);
  const nu = -(gx * hx + gy * hy) / (hx * hx + hy * hy);
  const stationary = Math.abs(tang) < 0.05 * Math.max(1, Math.hypot(gx, gy));

  const { wrap, w, h, theme } = useCanvasSize(0.62, 380);
  const cv = useRef<HTMLCanvasElement>(null);
  const bg = useRef<{ key: string; img: HTMLCanvasElement } | null>(null);
  const side = Math.min(w * 0.62, h);
  const view: View = useMemo(
    () => ({
      x0: -p.span,
      x1: p.span,
      y0: -p.span,
      y1: p.span,
      w: side,
      h: side,
    }),
    [p, side],
  );

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    const key = `${id}:${side}:${theme}`;
    if (!bg.current || bg.current.key !== key)
      bg.current = {
        key,
        img: contourImage(p.f, view, pal, {
          bands: 14,
          linear: id === 'saddle',
        }),
      };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg.current.img, 0, 0, side, side);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, side, side);

    const [cx, cy] = toPx(view, 0, 0);
    const pr = (p.r / (2 * p.span)) * side;
    ctx.lineWidth = 4;
    ctx.strokeStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.orange;
    ctx.stroke();

    const [px, py] = toPx(view, x, y);
    const gn = Math.hypot(gx, gy) || 1,
      hn = Math.hypot(hx, hy) || 1;
    const L = side * 0.16;
    arrow(
      ctx,
      px,
      py,
      px + (gx / gn) * L,
      py - (gy / gn) * L,
      pal.red,
      pal.ink,
    );
    arrow(
      ctx,
      px,
      py,
      px + (hx / hn) * L * 0.8,
      py - (hy / hn) * L * 0.8,
      pal.blue,
      pal.ink,
    );
    ctx.fillStyle = stationary ? pal.mint : pal.yellow;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right: f restricted to the circle, as a function of θ.
    const ox = side + 16,
      ow = w - ox - 4,
      oh = h - 30;
    if (ow > 80) {
      const vals = Array.from({ length: 361 }, (_, d) => {
        const t = (d * Math.PI) / 180;
        return p.f(p.r * Math.cos(t), p.r * Math.sin(t));
      });
      const lo = Math.min(...vals),
        hi = Math.max(...vals);
      const Y = (z: number) => 10 + (oh - 20) * (1 - (z - lo) / (hi - lo || 1));
      ctx.fillStyle = pal.paper;
      ctx.fillRect(ox, 0, ow, oh);
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(ox, 0, ow, oh);
      ctx.beginPath();
      vals.forEach((z, d) => {
        const X = ox + (d / 360) * ow;
        if (d) ctx.lineTo(X, Y(z));
        else ctx.moveTo(X, Y(z));
      });
      ctx.stroke();
      const X = ox + (deg / 360) * ow;
      ctx.fillStyle = stationary ? pal.mint : pal.yellow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X, Y(p.f(x, y)), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.muted;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('f on the constraint, θ = 0° … 360°', ox + 6, oh + 16);
    }
  }, [id, p, view, side, w, h, theme, x, y, gx, gy, hx, hy, deg, stationary]);

  return (
    <SimFrame
      title="Lagrange multipliers: when ∇f lines up with ∇h"
      hint="Slide the point round the constraint (orange). Red is ∇f, blue is ∇h. Wherever they are parallel the point turns green: ∇f + ν∇h = 0 holds. The right panel shows that the same condition catches minima AND maxima of f along the circle."
      controls={
        <>
          <Select
            label="Problem"
            value={id}
            onChange={setId}
            options={Object.entries(PROBS).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          <Slider
            label="θ"
            value={deg}
            min={0}
            max={360}
            step={1}
            onChange={setDeg}
            format={(v) => `${v}°`}
          />
        </>
      }
      readout={
        <p className="nb-sim-stat">
          x = ({fmt(x, 2)}, {fmt(y, 2)}) · f = <b>{fmt(p.f(x, y), 3)}</b> ·
          tangential part of ∇f = <b>{fmt(tang, 3)}</b>
          {stationary ? (
            <>
              {' '}
              · <b>candidate</b>, ν ≈ {fmt(nu, 3)}
            </>
          ) : (
            ' · not stationary: f still changes along the circle'
          )}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label="Objective contours, the constraint circle and the two gradients"
        />
      </div>
    </SimFrame>
  );
}
