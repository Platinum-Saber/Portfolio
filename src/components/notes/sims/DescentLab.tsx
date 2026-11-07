'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  rng,
  contourImage,
  drawPath,
  fmt,
  fromPx,
  palette,
  setupCanvas,
  toPx,
  type View,
} from './canvas';
import { Legend, Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

type Vec = [number, number];
type Fn = {
  label: string;
  f: (x: number, y: number) => number;
  g: (x: number, y: number) => Vec;
  H: (x: number, y: number) => [number, number, number]; // h11, h12, h22
  view: [number, number, number, number];
  start: Vec;
  alpha: number;
};

const FNS = (b: number): Record<string, Fn> => ({
  bowl: {
    label: '½(x₁² + b·x₂²) - ill-conditioned bowl',
    f: (x, y) => 0.5 * (x * x + b * y * y),
    g: (x, y) => [x, b * y],
    H: () => [1, 0, b],
    view: [-6, 6, -5, 5],
    start: [5, 4],
    alpha: 0.1,
  },
  rosen: {
    label: '(1 − x₁)² + 5(x₂ − x₁²)² - banana valley',
    f: (x, y) => (1 - x) ** 2 + 5 * (y - x * x) ** 2,
    g: (x, y) => [-2 * (1 - x) - 20 * x * (y - x * x), 10 * (y - x * x)],
    H: (x, y) => [2 - 20 * (y - x * x) + 40 * x * x, -20 * x, 10],
    view: [-2, 2, -1, 3],
    start: [-1.5, 2],
    alpha: 0.01,
  },
  himmel: {
    label: 'Himmelblau - four minima',
    f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
    g: (x, y) => [
      4 * x * (x * x + y - 11) + 2 * (x + y * y - 7),
      2 * (x * x + y - 11) + 4 * y * (x + y * y - 7),
    ],
    H: (x, y) => [
      12 * x * x + 4 * y - 42,
      4 * x + 4 * y,
      4 * x + 12 * y * y - 26,
    ],
    view: [-5, 5, -5, 5],
    start: [0, 0],
    alpha: 0.01,
  },
  saddle: {
    label: '(x₁² − 1)² + x₂² - saddle at the origin',
    f: (x, y) => (x * x - 1) ** 2 + y * y,
    g: (x, y) => [4 * x * (x * x - 1), 2 * y],
    H: (x) => [12 * x * x - 4, 0, 2],
    view: [-2, 2, -1.5, 1.5],
    start: [0, 1.2],
    alpha: 0.05,
  },
});

const METHODS = [
  { id: 'gd', label: 'GD', color: '#ff5d5d' },
  { id: 'noisy', label: 'Noisy GD', color: '#8d6e63' },
  { id: 'mom', label: 'Momentum', color: '#4f7cff' },
  { id: 'nes', label: 'Nesterov', color: '#9b5cff' },
  { id: 'ada', label: 'Adagrad', color: '#ff9f1c' },
  { id: 'rms', label: 'RMSProp', color: '#e84393' },
  { id: 'adam', label: 'Adam', color: '#12b886' },
  { id: 'newton', label: 'Newton (α = 1)', color: '#00a8e8' },
] as const;
type MethodId = (typeof METHODS)[number]['id'];

function run(fn: Fn, m: MethodId, x0: Vec, alpha: number, iters: number) {
  let [x, y] = x0;
  const pts: Vec[] = [[x, y]];
  let vx = 0,
    vy = 0,
    sx = 0,
    sy = 0;
  const r = rng(42); // fixed seed: the same noisy path every render
  const b1 = 0.9,
    b2 = 0.999,
    gam = 0.9,
    eps = 1e-8;
  for (let k = 1; k <= iters; k++) {
    let [gx, gy] = fn.g(x, y);
    if (m === 'gd') {
      x -= alpha * gx;
      y -= alpha * gy;
    } else if (m === 'noisy') {
      // Noisy descent: x ← x − αg + ε, ε ~ N(0, σ_k²), σ_k decaying.
      const sig = 0.3 / k;
      x += -alpha * gx + sig * r.normal();
      y += -alpha * gy + sig * r.normal();
    } else if (m === 'mom') {
      vx = b1 * vx - alpha * gx;
      vy = b1 * vy - alpha * gy;
      x += vx;
      y += vy;
    } else if (m === 'nes') {
      [gx, gy] = fn.g(x + b1 * vx, y + b1 * vy);
      vx = b1 * vx - alpha * gx;
      vy = b1 * vy - alpha * gy;
      x += vx;
      y += vy;
    } else if (m === 'ada') {
      sx += gx * gx;
      sy += gy * gy;
      x -= (alpha * gx) / (eps + Math.sqrt(sx));
      y -= (alpha * gy) / (eps + Math.sqrt(sy));
    } else if (m === 'rms') {
      sx = gam * sx + (1 - gam) * gx * gx;
      sy = gam * sy + (1 - gam) * gy * gy;
      x -= (alpha * gx) / (eps + Math.sqrt(sx));
      y -= (alpha * gy) / (eps + Math.sqrt(sy));
    } else if (m === 'adam') {
      vx = b1 * vx + (1 - b1) * gx;
      vy = b1 * vy + (1 - b1) * gy;
      sx = b2 * sx + (1 - b2) * gx * gx;
      sy = b2 * sy + (1 - b2) * gy * gy;
      const c1 = 1 - b1 ** k,
        c2 = 1 - b2 ** k;
      x -= (alpha * (vx / c1)) / (eps + Math.sqrt(sx / c2));
      y -= (alpha * (vy / c1)) / (eps + Math.sqrt(sy / c2));
    } else {
      // Full Newton step: solve H d = −g (2×2, by Cramer).
      const [a, c, d] = fn.H(x, y);
      const det = a * d - c * c;
      if (Math.abs(det) < 1e-12) break;
      x += -(d * gx - c * gy) / det;
      y += -(-c * gx + a * gy) / det;
    }
    pts.push([x, y]);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) + Math.abs(y) > 1e6
    )
      break;
    if (
      Math.hypot(gx, gy) < 1e-10 &&
      m !== 'mom' &&
      m !== 'nes' &&
      m !== 'noisy'
    )
      break;
  }
  return pts;
}

export function DescentLab({
  initial = 'bowl',
}: {
  initial?: 'bowl' | 'rosen' | 'himmel' | 'saddle';
}) {
  const [fnId, setFnId] = useState<string>(initial);
  const [b, setB] = useState(0.05);
  const fns = useMemo(() => FNS(b), [b]);
  const fn = fns[fnId];
  const [alpha, setAlpha] = useState(fn.alpha);
  const [iters, setIters] = useState(100);
  const [start, setStart] = useState<Vec>(fn.start);
  const [on, setOn] = useState<Record<MethodId, boolean>>({
    gd: true,
    noisy: false,
    mom: true,
    nes: false,
    ada: false,
    rms: false,
    adam: true,
    newton: false,
  });

  const { wrap, w, h, theme } = useCanvasSize(0.72);
  const cv = useRef<HTMLCanvasElement>(null);
  const bg = useRef<{ key: string; img: HTMLCanvasElement } | null>(null);

  const view: View = useMemo(() => {
    const [x0, x1, y0, y1] = fn.view;
    return { x0, x1, y0, y1, w, h };
  }, [fn, w, h]);

  const paths = useMemo(
    () =>
      METHODS.filter((m) => on[m.id]).map((m) => ({
        ...m,
        pts: run(
          fn,
          m.id,
          start,
          alpha,
          m.id === 'newton' ? Math.min(iters, 30) : iters,
        ),
      })),
    [fn, on, start, alpha, iters],
  );

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const key = `${fnId}:${b}:${w}:${h}:${theme}`;
    if (!bg.current || bg.current.key !== key)
      bg.current = { key, img: contourImage(fn.f, view, pal, { bands: 16 }) };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg.current.img, 0, 0, w, h);
    for (const p of paths) drawPath(ctx, view, p.pts, p.color, pal.ink);
    const [sx, sy] = toPx(view, start[0], start[1]);
    ctx.fillStyle = pal.yellow;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [paths, view, w, h, fn, fnId, b, theme, start]);

  const pick = (id: string) => {
    setFnId(id);
    setStart(fns[id].start);
    setAlpha(fns[id].alpha);
  };

  return (
    <SimFrame
      title="Descent methods on a contour map"
      hint="Click the map to move the start (yellow). Squares mark where each method ended. Try the bowl with b = 0.001. Then the saddle from (0, 1.2): the x₁-gradient is exactly zero on that line, so GD, momentum and Adam all stall at the saddle - only Noisy GD drifts off it."
      controls={
        <>
          <Select
            label="Function"
            value={fnId}
            onChange={pick}
            options={Object.entries(fns).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          {fnId === 'bowl' && (
            <Slider
              label="b"
              value={b}
              min={0.001}
              max={1}
              log
              onChange={setB}
              format={(v) => fmt(v)}
            />
          )}
          <Slider
            label="α"
            value={alpha}
            min={0.0005}
            max={1}
            log
            onChange={setAlpha}
            format={(v) => fmt(v, 4)}
          />
          <Slider
            label="iterations"
            value={iters}
            min={5}
            max={500}
            step={5}
            onChange={setIters}
          />
          <div className="nb-checks" role="group" aria-label="Methods">
            {METHODS.map((m) => (
              <label key={m.id} className="nb-check">
                <input
                  type="checkbox"
                  checked={on[m.id]}
                  onChange={(e) => setOn({ ...on, [m.id]: e.target.checked })}
                />
                <span className="nb-swatch" style={{ background: m.color }} />
                {m.label}
              </label>
            ))}
          </div>
        </>
      }
      readout={
        <Legend
          items={paths.map((p) => {
            const [x, y] = p.pts[p.pts.length - 1];
            const v = fn.f(x, y);
            return {
              color: p.color,
              label: p.label,
              value:
                Number.isFinite(v) && Math.abs(x) + Math.abs(y) < 1e6
                  ? `f = ${fmt(v)} at (${fmt(x, 2)}, ${fmt(y, 2)}) · ${p.pts.length - 1} steps`
                  : 'diverged',
            };
          })}
        />
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label={`Contour map of ${fn.label} with optimizer paths`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setStart(fromPx(view, e.clientX - r.left, e.clientY - r.top));
          }}
        />
      </div>
    </SimFrame>
  );
}
