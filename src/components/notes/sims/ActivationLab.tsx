'use client';

import { useEffect, useRef, useState } from 'react';
import { axes, fmt, palette, setupCanvas, ticks, toPx, type View } from './canvas';
import { Legend, Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * Activation functions f(σ·x + b) and their derivatives. Shows the bias shift
 * (positive b moves the curve left) and how the slope σ turns a sigmoid into a
 * step and changes the gradient that backpropagation sees.
 */

type Fn = 'step' | 'logsig' | 'bipolar' | 'tanh' | 'relu' | 'linear' | 'satlin' | 'atan' | 'gauss';
const sig = (x: number) => 1 / (1 + Math.exp(-x));

const FN: Record<Fn, { label: string; f: (n: number) => number; d: (n: number) => number; lo: number; hi: number; note: string }> = {
  step: { label: 'Hard limit (step)', f: (n) => (n >= 0 ? 1 : 0), d: () => 0, lo: -0.2, hi: 1.2, note: 'derivative 0 almost everywhere - no gradient, so no backpropagation' },
  logsig: { label: 'Binary sigmoid (logsig)', f: sig, d: (n) => sig(n) * (1 - sig(n)), lo: -0.2, hi: 1.2, note: "f' = f(1 − f), at most 0.25 (at n = 0)" },
  bipolar: { label: 'Bipolar sigmoid', f: (n) => 2 * sig(n) - 1, d: (n) => 0.5 * (1 + (2 * sig(n) - 1)) * (1 - (2 * sig(n) - 1)), lo: -1.2, hi: 1.2, note: "f' = ½(1 + f)(1 − f), at most 0.5" },
  tanh: { label: 'Hyperbolic tangent (tansig)', f: Math.tanh, d: (n) => 1 - Math.tanh(n) ** 2, lo: -1.2, hi: 1.2, note: "f' = 1 − f², at most 1; zero-centred" },
  relu: { label: 'ReLU (poslin)', f: (n) => Math.max(0, n), d: (n) => (n > 0 ? 1 : 0), lo: -0.5, hi: 3, note: 'no saturation for n > 0; zero gradient for n < 0' },
  linear: { label: 'Linear (purelin)', f: (n) => n, d: () => 1, lo: -3, hi: 3, note: 'regression outputs; a stack of linear layers is still linear' },
  satlin: { label: 'Saturating linear (satlin)', f: (n) => Math.min(1, Math.max(0, n)), d: (n) => (n > 0 && n < 1 ? 1 : 0), lo: -0.2, hi: 1.2, note: 'linear on [0, 1], clipped outside' },
  atan: { label: 'Arctangent', f: Math.atan, d: (n) => 1 / (1 + n * n), lo: -1.7, hi: 1.7, note: "f' = 1/(1 + x²): polynomial decay keeps more gradient for large |x|" },
  gauss: { label: 'Gaussian (RBF)', f: (n) => Math.exp(-(n * n) / 2), d: (n) => -n * Math.exp(-(n * n) / 2), lo: -0.7, hi: 1.2, note: 'local: responds to a region around the centre, not a half-space' },
};

export function ActivationLab() {
  const [fn, setFn] = useState<Fn>('logsig');
  const [b, setB] = useState(0);
  const [s, setS] = useState(1);
  const [showD, setShowD] = useState(true);
  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);
  const F = FN[fn];

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    const v: View = { x0: -6, x1: 6, y0: F.lo, y1: F.hi, w, h };
    axes(ctx, v, pal, ticks(-6, 6), ticks(F.lo, F.hi, 4));
    // x = 0 and y = 0 axes
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.2;
    let [ax, ay] = toPx(v, 0, 0);
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, h); ctx.moveTo(0, ay); ctx.lineTo(w, ay); ctx.stroke();
    const plot = (g: (x: number) => number, col: string, width: number, dash: number[] = []) => {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      let prev = NaN;
      for (let i = 0; i <= 600; i++) {
        const x = -6 + (12 * i) / 600;
        const y = g(x);
        const [px, py] = toPx(v, x, y);
        // break the path at jumps (step function)
        if (i === 0 || Math.abs(y - prev) > 0.5) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        prev = y;
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    // the unshifted curve, faint, for comparison
    ctx.globalAlpha = 0.3; plot(F.f, pal.muted, 2); ctx.globalAlpha = 1;
    if (showD) plot((x) => s * F.d(s * x + b), pal.orange, 2.5, [6, 4]);
    plot((x) => F.f(s * x + b), pal.ink, 5);
    plot((x) => F.f(s * x + b), pal.blue, 3);
    // midpoint marker: where the net input σx + b = 0
    const xm = -b / s;
    if (xm > -6 && xm < 6) {
      [ax, ay] = toPx(v, xm, F.f(0));
      ctx.fillStyle = pal.yellow; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }, [F, b, s, showD, w, h, theme]);

  return (
    <SimFrame
      title="Activation functions - bias shifts, slope sharpens"
      hint="The neuron computes f(σ·x + b). The yellow dot is where the net input is zero, at x = −b/σ: a positive bias moves the curve LEFT, a negative bias moves it right (Lesson 1, Example 2). Raise σ and the sigmoid approaches a step - and the derivative (orange) becomes a tall narrow spike: large gradients near the boundary, almost none elsewhere."
      controls={
        <>
          <Select label="function" value={fn} onChange={setFn} options={(Object.keys(FN) as Fn[]).map((k) => ({ value: k, label: FN[k].label }))} />
          <Slider label="bias b" value={b} min={-4} max={4} step={0.5} onChange={setB} />
          <Slider label="slope σ" value={s} min={0.25} max={6} step={0.25} onChange={setS} />
          <label className="nb-check">
            <input type="checkbox" checked={showD} onChange={(e) => setShowD(e.target.checked)} /> show derivative
          </label>
        </>
      }
      readout={
        <>
          <Legend
            items={[
              { color: 'var(--nb-blue)', label: `f(σx + b)` },
              { color: 'var(--nb-orange)', label: 'd f / d x' },
              { color: 'var(--nb-muted)', label: 'b = 0, σ = 1' },
            ]}
          />
          <p className="nb-sim-stat">
            midpoint at x = −b/σ = <b>{fmt(-b / s, 2)}</b> · {F.note}
          </p>
        </>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Activation function plot" />
      </div>
    </SimFrame>
  );
}
