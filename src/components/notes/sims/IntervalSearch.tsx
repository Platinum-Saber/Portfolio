'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  axes,
  fmt,
  palette,
  setupCanvas,
  ticks,
  toPx,
  type View,
} from './canvas';
import {
  Select,
  SimFrame,
  Slider,
  useCanvasSize,
  useKeyedStep,
} from './SimFrame';

type Method = 'golden' | 'fib' | 'bisect';
type Fn = {
  label: string;
  f: (x: number) => number;
  df: (x: number) => number;
  a: number;
  b: number;
};

const FNS: Record<string, Fn> = {
  sq: {
    label: 'x² on [−2, 6]',
    f: (x) => x * x,
    df: (x) => 2 * x,
    a: -2,
    b: 6,
  },
  exp: {
    label: 'eˣ − 2x on [−1, 3]',
    f: (x) => Math.exp(x) - 2 * x,
    df: (x) => Math.exp(x) - 2,
    a: -1,
    b: 3,
  },
  quart: {
    label: '(x − 1)⁴ + 0.5(x − 1)² on [−3, 4]',
    f: (x) => (x - 1) ** 4 + 0.5 * (x - 1) ** 2,
    df: (x) => 4 * (x - 1) ** 3 + (x - 1),
    a: -3,
    b: 4,
  },
};

const PHI = (1 + Math.sqrt(5)) / 2;
const RHO = 1 - 1 / PHI; // ≈ 0.382

function fibs(n: number) {
  const F = [1, 1];
  while (F.length <= n + 2) F.push(F[F.length - 1] + F[F.length - 2]);
  return F;
}

type Row = {
  k: number;
  a: number;
  b: number;
  p?: number;
  q?: number;
  fp?: number;
  fq?: number;
};

/** Every iteration's interval and query points, computed up front so the stepper can scrub. */
function trace(fn: Fn, m: Method, N: number, eps: number): Row[] {
  let a = fn.a,
    b = fn.b;
  const rows: Row[] = [{ k: 0, a, b }];
  if (m === 'bisect') {
    for (let k = 1; k <= N; k++) {
      const c = (a + b) / 2;
      const d = fn.df(c);
      rows[rows.length - 1].p = c;
      rows[rows.length - 1].fp = d;
      if (d > 0) b = c;
      else a = c;
      rows.push({ k, a, b });
    }
    return rows;
  }
  const F = fibs(N);
  for (let k = 1; k <= N; k++) {
    let rho: number;
    if (m === 'golden') rho = RHO;
    else {
      // ρ_k = 1 − F_{N−k+1}/F_{N−k+2} with F₀ = F₁ = 1 (Chong & Żak), so the
      // last step would be exactly ½ - the two points coincide - hence ½ − ε.
      rho = 1 - F[N - k + 1] / F[N - k + 2];
      if (k === N) rho = 0.5 - eps;
    }
    const p = a + rho * (b - a);
    const q = a + (1 - rho) * (b - a);
    const fp = fn.f(p),
      fq = fn.f(q);
    Object.assign(rows[rows.length - 1], { p, q, fp, fq });
    if (fp < fq) b = q;
    else a = p;
    rows.push({ k, a, b });
  }
  return rows;
}

export function IntervalSearch() {
  const [fnId, setFnId] = useState('sq');
  const [m, setM] = useState<Method>('golden');
  const [N, setN] = useState(6);
  const [k, setK] = useKeyedStep(`${fnId}|${m}|${N}`);
  const fn = FNS[fnId];
  const rows = useMemo(() => trace(fn, m, N, 0.05), [fn, m, N]);
  const cur = rows[Math.min(k, rows.length - 1)];

  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const xs = Array.from(
      { length: 200 },
      (_, i) => fn.a + ((fn.b - fn.a) * i) / 199,
    );
    const ys = xs.map(fn.f);
    const lo = Math.min(...ys),
      hi = Math.max(...ys);
    const pad = (hi - lo) * 0.12;
    const v: View = { x0: fn.a, x1: fn.b, y0: lo - pad, y1: hi + pad, w, h };
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    // Discarded regions hatched, the live interval tinted.
    const [ax] = toPx(v, cur.a, 0),
      [bx] = toPx(v, cur.b, 0);
    ctx.fillStyle = pal.mint;
    ctx.fillRect(ax, 0, bx - ax, h);
    ctx.save();
    ctx.strokeStyle = pal.ink;
    ctx.globalAlpha = 0.25;
    for (let x = -h; x < w; x += 10) {
      if (x + h < ax || x > bx) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + h, 0);
        ctx.stroke();
      }
    }
    ctx.restore();
    axes(ctx, v, pal, ticks(fn.a, fn.b), ticks(v.y0, v.y1, 4));
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    xs.forEach((x, i) => {
      const [px, py] = toPx(v, x, ys[i]);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
    for (const [x, col] of [
      [cur.a, pal.ink],
      [cur.b, pal.ink],
    ] as const) {
      const [px] = toPx(v, x, 0);
      ctx.fillStyle = col;
      ctx.fillRect(px - 2, 0, 4, h);
    }
    const qs: [number | undefined, string][] = [
      [cur.p, pal.pink],
      [cur.q, pal.orange],
    ];
    for (const [x, col] of qs) {
      if (x === undefined) continue;
      const [px, py] = toPx(v, x, m === 'bisect' ? fn.f(x) : fn.f(x));
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, h);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [fn, cur, w, h, theme, m]);

  const width = cur.b - cur.a;
  const total = fn.b - fn.a;
  return (
    <SimFrame
      title="Shrinking the interval: golden section, Fibonacci, bisection"
      hint="Pink and orange are the two queries; the hatched side is discarded. Golden section keeps a fixed 0.618 of the interval; Fibonacci squeezes a little more out of the same N; bisection halves, but uses f′."
      controls={
        <>
          <Select
            label="Function"
            value={fnId}
            onChange={setFnId}
            options={Object.entries(FNS).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          <Select
            label="Method"
            value={m}
            onChange={setM}
            options={[
              { value: 'golden', label: 'Golden section (ρ ≈ 0.382)' },
              { value: 'fib', label: 'Fibonacci (needs N up front)' },
              { value: 'bisect', label: 'Bisection on f′' },
            ]}
          />
          <Slider
            label="N"
            value={N}
            min={2}
            max={14}
            step={1}
            onChange={setN}
          />
          <div className="nb-btnrow">
            <button
              type="button"
              className="nb-btn nb-btn-sm"
              onClick={() => setK(0)}
            >
              Reset
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-sm nb-btn-primary"
              onClick={() => setK((x) => Math.min(rows.length - 1, x + 1))}
              disabled={k >= rows.length - 1}
            >
              Step →
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-sm"
              onClick={() => setK(rows.length - 1)}
            >
              Run all
            </button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          Iteration <b>{cur.k}</b> of {N} · interval [{fmt(cur.a)}, {fmt(cur.b)}
          ] · width <b>{fmt(width)}</b> = {fmt(width / total, 4)} × initial
          {m === 'golden' && (
            <>
              {' '}
              · theory 0.618<sup>{cur.k}</sup> = {fmt(0.618034 ** cur.k, 4)}
            </>
          )}
          {m === 'bisect' && (
            <>
              {' '}
              · theory 0.5<sup>{cur.k}</sup> = {fmt(0.5 ** cur.k, 4)}
            </>
          )}
          {m === 'fib' && k === rows.length - 1 && (
            <>
              {' '}
              · theory (1 + 2ε)/F<sub>N+1</sub> = {fmt(1.1 / fibs(N)[N + 1], 4)}
            </>
          )}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label="Function with the current search interval"
        />
      </div>
    </SimFrame>
  );
}
