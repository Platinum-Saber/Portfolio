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

type Fn = {
  label: string;
  f: (x: number) => number;
  d1: (x: number) => number;
  d2: (x: number) => number;
  lo: number;
  hi: number;
  x0: number;
  note: string;
};

const FNS: Record<string, Fn> = {
  good: {
    label: 'eˣ − 2x (well behaved)',
    f: (x) => Math.exp(x) - 2 * x,
    d1: (x) => Math.exp(x) - 2,
    d2: (x) => Math.exp(x),
    lo: -2,
    hi: 3,
    x0: 2.5,
    note: 'Positive curvature everywhere: quadratic convergence - the digits double each step.',
  },
  quartic: {
    label: 'x⁴/4 (flat minimum)',
    f: (x) => x ** 4 / 4,
    d1: (x) => x ** 3,
    d2: (x) => 3 * x * x,
    lo: -2,
    hi: 2,
    x0: 1.6,
    note: 'f″ → 0 at the minimizer, so x_{k+1} = 2x_k/3: only linear convergence.',
  },
  cubic: {
    label: 'x³ − 3x (min and max)',
    f: (x) => x ** 3 - 3 * x,
    d1: (x) => 3 * x * x - 3,
    d2: (x) => 6 * x,
    lo: -2.5,
    hi: 2.5,
    x0: -0.4,
    note: 'Newton solves f′ = 0 without asking which kind of point: start left of 0 and it walks to the maximum at −1.',
  },
  sqrt: {
    label: '√(1 + x²) (far start diverges)',
    f: (x) => Math.sqrt(1 + x * x),
    d1: (x) => x / Math.sqrt(1 + x * x),
    d2: (x) => (1 + x * x) ** -1.5,
    lo: -4,
    hi: 4,
    x0: 0.9,
    note: 'x_{k+1} = −x_k³: converges for |x₀| < 1, diverges for |x₀| > 1. Try x₀ = 1.1.',
  },
};

export function NewtonLab() {
  const [id, setId] = useState('good');
  const fn = FNS[id];
  const [x0, setX0] = useState(fn.x0);
  const [k, setK] = useKeyedStep(`${id}|${x0}`);
  const pick = (v: string) => {
    setId(v);
    setX0(FNS[v].x0);
  };

  const xs = useMemo(() => {
    const out = [x0];
    for (let i = 0; i < 12; i++) {
      const x = out[out.length - 1];
      const h = fn.d2(x);
      if (!Number.isFinite(x) || Math.abs(x) > 1e8 || h === 0) break;
      out.push(x - fn.d1(x) / h);
    }
    return out;
  }, [fn, x0]);
  const cur = xs[Math.min(k, xs.length - 1)];
  const nxt = xs[Math.min(k + 1, xs.length - 1)];

  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const grid = Array.from(
      { length: 300 },
      (_, i) => fn.lo + ((fn.hi - fn.lo) * i) / 299,
    );
    const ys = grid.map(fn.f);
    const lo = Math.min(...ys),
      hi = Math.max(...ys);
    const pad = (hi - lo) * 0.15 || 1;
    const v: View = { x0: fn.lo, x1: fn.hi, y0: lo - pad, y1: hi + pad, w, h };
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    axes(ctx, v, pal, ticks(fn.lo, fn.hi), ticks(v.y0, v.y1, 4));

    // Quadratic model at the current point.
    const q = (x: number) =>
      fn.f(cur) + fn.d1(cur) * (x - cur) + 0.5 * fn.d2(cur) * (x - cur) ** 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.orange;
    ctx.beginPath();
    grid.forEach((x, i) => {
      const [px, py] = toPx(v, x, q(x));
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    grid.forEach((x, i) => {
      const [px, py] = toPx(v, x, ys[i]);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();

    xs.slice(0, k + 1).forEach((x, i) => {
      if (x < fn.lo || x > fn.hi) return;
      const [px, py] = toPx(v, x, fn.f(x));
      ctx.fillStyle = i === k ? pal.yellow : pal.pink;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, i === k ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    if (k + 1 < xs.length && nxt >= fn.lo && nxt <= fn.hi) {
      const [px] = toPx(v, nxt, 0);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [fn, xs, k, cur, nxt, w, h, theme]);

  return (
    <SimFrame
      title="Newton's method: jump to the model's stationary point"
      hint="Dashed orange: the quadratic Taylor model at the yellow point. Newton moves to where the model is flat (dotted line). Step through each function to see the three failure modes."
      controls={
        <>
          <Select
            label="Function"
            value={id}
            onChange={pick}
            options={Object.entries(FNS).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          <Slider
            label="x₀"
            value={x0}
            min={fn.lo}
            max={fn.hi}
            step={0.05}
            onChange={setX0}
            format={(x) => fmt(x, 2)}
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
              onClick={() => setK((x) => Math.min(xs.length - 1, x + 1))}
              disabled={k >= xs.length - 1}
            >
              Newton step →
            </button>
          </div>
        </>
      }
      readout={
        <>
          <p className="nb-sim-stat">
            k = <b>{k}</b> · x = <b>{fmt(cur, 6)}</b> · f′(x) ={' '}
            {fmt(fn.d1(cur), 4)} · f″(x) = {fmt(fn.d2(cur), 4)}
            {fn.d2(cur) < 0 && (
              <b> · f″ &lt; 0: the model is a hill, the step goes uphill</b>
            )}
          </p>
          <p className="nb-sim-stat">{fn.note}</p>
        </>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label="Function, Newton iterates and the local quadratic model"
        />
      </div>
    </SimFrame>
  );
}
