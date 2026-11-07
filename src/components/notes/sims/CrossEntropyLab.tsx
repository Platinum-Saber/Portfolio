'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  axes,
  fmt,
  palette,
  rng,
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
  lo: number;
  hi: number;
  mu0: number;
  var0: number;
};
const FNS: Record<string, Fn> = {
  sq: {
    label: 'f = x² (the notes run)',
    f: (x) => x * x,
    lo: -15,
    hi: 40,
    mu0: 20,
    var0: 70,
  },
  rast: {
    label: 'Rastrigin 10 + x² − 10cos 2πx',
    f: (x) => 10 + x * x - 10 * Math.cos(2 * Math.PI * x),
    lo: -6,
    hi: 6,
    mu0: 3.6,
    var0: 4,
  },
};

type Gen = { mu: number; v: number; xs: number[]; elite: number[] };

/** The whole run, generation by generation, from one seed - so the stepper can scrub back. */
function simulate(
  fn: Fn,
  mu0: number,
  var0: number,
  N: number,
  Ne: number,
  seed: number,
  G = 12,
): Gen[] {
  const r = rng(seed);
  const out: Gen[] = [];
  let mu = mu0,
    v = var0;
  for (let g = 0; g < G; g++) {
    const sd = Math.sqrt(v);
    const xs = Array.from({ length: N }, () => mu + sd * r.normal());
    const elite = [...xs].sort((a, b) => fn.f(a) - fn.f(b)).slice(0, Ne);
    out.push({ mu, v, xs, elite });
    // MLE refit on the elites.
    mu = elite.reduce((s, x) => s + x, 0) / Ne;
    v = Math.max(1e-12, elite.reduce((s, x) => s + (x - mu) ** 2, 0) / Ne);
  }
  out.push({ mu, v, xs: [], elite: [] });
  return out;
}

export function CrossEntropyLab() {
  const [id, setId] = useState('sq');
  const fn = FNS[id];
  const [mu0, setMu0] = useState(fn.mu0);
  const [var0, setVar0] = useState(fn.var0);
  const [N, setN] = useState(100);
  const [Ne, setNe] = useState(10);
  const [seed, setSeed] = useState(1);
  const [g, setG] = useKeyedStep(`${id}|${mu0}|${var0}|${N}|${Ne}|${seed}`);
  const pick = (v: string) => {
    setId(v);
    setMu0(FNS[v].mu0);
    setVar0(FNS[v].var0);
  };
  const gens = useMemo(
    () => simulate(fn, mu0, var0, N, Math.min(Ne, N), seed),
    [fn, mu0, var0, N, Ne, seed],
  );
  const cur = gens[Math.min(g, gens.length - 1)];

  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const xs = Array.from(
      { length: 400 },
      (_, i) => fn.lo + ((fn.hi - fn.lo) * i) / 399,
    );
    const ys = xs.map(fn.f);
    const top = Math.max(...ys);
    const v: View = {
      x0: fn.lo,
      x1: fn.hi,
      y0: -top * 0.08,
      y1: top * 1.05,
      w,
      h: h - 26,
    };
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    axes(ctx, v, pal, ticks(fn.lo, fn.hi, 8), ticks(0, top, 4));

    // Current proposal density, scaled to a third of the plot height.
    const sd = Math.sqrt(cur.v);
    const pdf = (x: number) => Math.exp(-0.5 * ((x - cur.mu) / sd) ** 2);
    ctx.beginPath();
    xs.forEach((x, i) => {
      const [px, py] = toPx(v, x, pdf(x) * top * 0.35);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    const [, base] = toPx(v, 0, 0);
    ctx.lineTo(w, base);
    ctx.lineTo(0, base);
    ctx.closePath();
    ctx.fillStyle = pal.yellow;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    xs.forEach((x, i) => {
      const [px, py] = toPx(v, x, ys[i]);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();

    const elite = new Set(cur.elite);
    for (const x of cur.xs) {
      if (x < fn.lo || x > fn.hi) continue;
      const [px] = toPx(v, x, 0);
      const e = elite.has(x);
      ctx.fillStyle = e ? pal.mint : pal.pink;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(px - (e ? 3.5 : 2), h - (e ? 22 : 16), e ? 7 : 4, e ? 18 : 12);
      ctx.fill();
      ctx.stroke();
    }
    const [mx] = toPx(v, cur.mu, 0);
    ctx.fillStyle = pal.ink;
    ctx.fillRect(mx - 1.5, 0, 3, h - 26);
  }, [cur, fn, w, h, theme]);

  return (
    <SimFrame
      title="Cross-entropy method: sample, keep the elites, refit"
      hint="Yellow = the current Gaussian proposal. Pink ticks are samples, green the elites (lowest f). The black line is μ. On x² with σ₀² = 70 it reaches 0 in a few generations; drop σ₀² to 20 and watch the variance collapse before it arrives. Press New seed a few times: even at 70, about one run in four collapses early - judge a stochastic method over many runs."
      controls={
        <>
          <Select
            label="Objective"
            value={id}
            onChange={pick}
            options={Object.entries(FNS).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          <Slider
            label="μ₀"
            value={mu0}
            min={fn.lo}
            max={fn.hi}
            step={0.1}
            onChange={setMu0}
            format={(x) => fmt(x, 1)}
          />
          <Slider
            label="σ₀²"
            value={var0}
            min={0.1}
            max={200}
            log
            onChange={setVar0}
            format={(x) => fmt(x, 1)}
          />
          <Slider
            label="N samples"
            value={N}
            min={10}
            max={300}
            step={10}
            onChange={setN}
          />
          <Slider
            label="Nₑ elites"
            value={Ne}
            min={2}
            max={50}
            step={1}
            onChange={setNe}
          />
          <div className="nb-btnrow">
            <button
              type="button"
              className="nb-btn nb-btn-sm"
              onClick={() => setG(0)}
            >
              Reset
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-sm nb-btn-primary"
              onClick={() => setG((x) => Math.min(gens.length - 1, x + 1))}
              disabled={g >= gens.length - 1}
            >
              Next generation →
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-sm"
              onClick={() => setSeed((s) => s + 1)}
            >
              New seed
            </button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          Generation <b>{g}</b> · μ = <b>{fmt(cur.mu, 4)}</b> · σ² ={' '}
          <b>{fmt(cur.v, 4)}</b> · f(μ) = {fmt(fn.f(cur.mu), 4)} · seed {seed}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label="Cross-entropy samples and proposal distribution"
        />
      </div>
    </SimFrame>
  );
}
