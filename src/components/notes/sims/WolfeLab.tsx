'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  axes,
  fmt,
  palette,
  setupCanvas,
  ticks,
  toPx,
  type View,
} from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

type Slice = {
  label: string;
  phi: (a: number) => number;
  dphi: (a: number) => number;
  amax: number;
};

// f = x₁ + x₁x₂ + x₁², x = [1, 2], d = [−1, −2]  ⇒  φ(α) = (1−α) + 3(1−α)², φ′(0) = −7.
const NOTES: Slice = {
  label: 'Notes example: f = x₁ + x₁x₂ + x₁² from [1, 2] along [−1, −2]',
  phi: (a) => 1 - a + 3 * (1 - a) ** 2,
  dphi: (a) => -1 - 6 * (1 - a),
  amax: 10,
};

// Rosenbrock (a = 1, b = 100) from [−1.2, 1] along the normalized steepest descent direction.
const R0: [number, number] = [-1.2, 1];
const rg = (x: number, y: number): [number, number] => [
  -2 * (1 - x) - 400 * x * (y - x * x),
  200 * (y - x * x),
];
const g0 = rg(...R0);
const n0 = Math.hypot(...g0);
const RD: [number, number] = [-g0[0] / n0, -g0[1] / n0];
const ROSEN: Slice = {
  label: 'Rosenbrock from [−1.2, 1] along −∇f/‖∇f‖',
  phi: (a) => {
    const x = R0[0] + a * RD[0],
      y = R0[1] + a * RD[1];
    return (1 - x) ** 2 + 100 * (y - x * x) ** 2;
  },
  dphi: (a) => {
    const [gx, gy] = rg(R0[0] + a * RD[0], R0[1] + a * RD[1]);
    return gx * RD[0] + gy * RD[1];
  },
  amax: 1,
};

const SLICES: Record<string, Slice> = { notes: NOTES, rosen: ROSEN };

export function WolfeLab() {
  const [id, setId] = useState('notes');
  const s = SLICES[id];
  const [beta, setBeta] = useState(1e-4);
  const [sigma, setSigma] = useState(0.9);
  const [shrink, setShrink] = useState(0.5);
  const [amax, setAmax] = useState(s.amax);

  const f0 = s.phi(0),
    d0 = s.dphi(0);
  const ok1 = useCallback(
    (a: number) => s.phi(a) <= f0 + beta * a * d0,
    [s, f0, beta, d0],
  );
  const ok2 = useCallback(
    (a: number) => s.dphi(a) >= sigma * d0,
    [s, sigma, d0],
  );

  const trials = useMemo(() => {
    const out: { a: number; pass: boolean }[] = [];
    let a = amax;
    for (let i = 0; i < 40; i++) {
      const pass = s.phi(a) <= f0 + beta * a * d0;
      out.push({ a, pass });
      if (pass) break;
      a *= shrink;
    }
    return out;
  }, [s, amax, beta, shrink, f0, d0]);
  const accepted = trials.find((t) => t.pass)?.a;

  const { wrap, w, h, theme } = useCanvasSize(0.55, 340);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const n = 300;
    const as = Array.from({ length: n }, (_, i) => (amax * i) / (n - 1));
    const ys = as.map(s.phi);
    // Clip the view to the interesting part so one huge value does not flatten the plot.
    const sorted = [...ys].sort((p, q) => p - q);
    const lo = Math.min(
      sorted[0],
      f0 + beta * amax * d0,
      f0 + d0 * amax * 0.15,
    );
    const hi = Math.max(f0 * 1.8 + 1, sorted[Math.floor(n * 0.6)]);
    const v: View = {
      x0: 0,
      x1: amax,
      y0: lo - (hi - lo) * 0.08,
      y1: hi,
      w,
      h: h - 34,
    };
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    axes(ctx, v, pal, ticks(0, amax), ticks(v.y0, v.y1, 4));

    // Condition strips under the plot.
    const strip = (
      y: number,
      test: (a: number) => boolean,
      col: string,
      label: string,
    ) => {
      for (let i = 0; i < n - 1; i++) {
        if (!test(as[i])) continue;
        const [x0] = toPx(v, as[i], 0),
          [x1] = toPx(v, as[i + 1], 0);
        ctx.fillStyle = col;
        ctx.fillRect(x0, y, x1 - x0 + 0.5, 10);
      }
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, y, w - 1, 10);
      ctx.fillStyle = pal.muted;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(label, 4, y - 2);
    };
    strip(h - 28, ok1, pal.mint, '');
    strip(h - 12, ok2, pal.blue, '');

    // Armijo line and tangent.
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    let [x0, y0] = toPx(v, 0, f0);
    let [x1, y1] = toPx(v, amax, f0 + beta * amax * d0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([2, 4]);
    [x1, y1] = toPx(v, amax, f0 + sigma * d0 * amax);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = 3;
    ctx.beginPath();
    as.forEach((a, i) => {
      const [px, py] = toPx(v, a, Math.min(ys[i], v.y1 * 4));
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();

    trials.forEach((t, i) => {
      [x0, y0] = toPx(v, t.a, Math.min(s.phi(t.a), v.y1));
      ctx.fillStyle = t.pass ? pal.mint : pal.red;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x0, Math.max(8, y0), t.pass ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(String(i + 1), x0 + 9, Math.max(8, y0) - 6);
    });
  }, [s, beta, sigma, amax, trials, w, h, theme, f0, d0, ok1, ok2]);

  return (
    <SimFrame
      title="Backtracking and the Wolfe conditions"
      hint="Thick curve: φ(α) = f(x + αd). Dashed: the Armijo line f(x) + βα∇fᵀd. Dotted: slope σ∇fᵀd. Green strip = steps passing condition 1 (not too long); blue strip = condition 2 (not too short). Numbered dots are the backtracking trials."
      controls={
        <>
          <Select
            label="Slice"
            value={id}
            onChange={(v) => {
              setId(v);
              setAmax(SLICES[v].amax);
            }}
            options={Object.entries(SLICES).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          <Slider
            label="β (Armijo)"
            value={beta}
            min={1e-4}
            max={0.5}
            log
            onChange={setBeta}
            format={(x) => fmt(x, 4)}
          />
          <Slider
            label="σ (curvature)"
            value={sigma}
            min={0.05}
            max={0.99}
            onChange={(x) => setSigma(Math.max(x, beta + 0.01))}
            format={(x) => fmt(x, 2)}
          />
          <Slider
            label="α max"
            value={amax}
            min={s.amax / 10}
            max={s.amax * 2}
            onChange={setAmax}
            format={(x) => fmt(x, 2)}
          />
          <Slider
            label="shrink factor"
            value={shrink}
            min={0.1}
            max={0.9}
            onChange={setShrink}
            format={(x) => fmt(x, 2)}
          />
        </>
      }
      readout={
        <div className="nb-sim-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>α</th>
                <th>φ(α)</th>
                <th>threshold</th>
                <th>cond. 1</th>
                <th>cond. 2</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{fmt(t.a, 4)}</td>
                  <td>{fmt(s.phi(t.a), 4)}</td>
                  <td>{fmt(f0 + beta * t.a * d0, 6)}</td>
                  <td>{t.pass ? '✓' : '✗'}</td>
                  <td>{t.pass ? (ok2(t.a) ? '✓' : '✗') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nb-sim-stat">
            φ(0) = {fmt(f0)}, φ′(0) = {fmt(d0)}.{' '}
            {accepted !== undefined ? (
              <>
                Backtracking accepts <b>α = {fmt(accepted, 4)}</b>
                {ok2(accepted)
                  ? ', which also passes the curvature test.'
                  : ' - but it fails the curvature test: Armijo alone does not enforce it.'}
              </>
            ) : (
              'No step accepted in 40 trials.'
            )}
          </p>
        </div>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label="Line-search slice with the Wolfe condition regions"
        />
      </div>
    </SimFrame>
  );
}
