'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fmt, palette, rng, setupCanvas } from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * A 2-p-1 network with binary-sigmoid units learns XOR by standard
 * backpropagation (Lesson 4), optionally with momentum (Lesson 4 ctd) and
 * Nguyen–Widrow initialisation. Left: the network's output over the input
 * square; right: total squared error per epoch.
 */

const DATA = [
  { x: [0, 0], t: 0 },
  { x: [0, 1], t: 1 },
  { x: [1, 0], t: 1 },
  { x: [1, 1], t: 0 },
];
const f = (x: number) => 1 / (1 + Math.exp(-x));

type Net = {
  v: number[][]; // v[i][j]: input i → hidden j
  v0: number[];
  w: number[]; // hidden j → output
  w0: number;
  dv: number[][];
  dv0: number[];
  dw: number[];
  dw0: number;
};

function init(p: number, mode: 'random' | 'nw', seed: number): Net {
  const r = rng(seed);
  const u = () => r.u() - 0.5; // uniform in [-0.5, 0.5]
  const v = [Array.from({ length: p }, u), Array.from({ length: p }, u)];
  let v0 = Array.from({ length: p }, u);
  if (mode === 'nw') {
    // Nguyen–Widrow: rescale each hidden unit's weight vector to length β = 0.7 p^(1/n).
    const beta = 0.7 * p ** (1 / 2);
    for (let j = 0; j < p; j++) {
      const norm = Math.hypot(v[0][j], v[1][j]) || 1;
      v[0][j] = (beta * v[0][j]) / norm;
      v[1][j] = (beta * v[1][j]) / norm;
    }
    v0 = v0.map((b) => 2 * beta * b); // bias uniform in [-β, β]
  }
  return {
    v, v0, w: Array.from({ length: p }, u), w0: u(),
    dv: [Array(p).fill(0), Array(p).fill(0)], dv0: Array(p).fill(0), dw: Array(p).fill(0), dw0: 0,
  };
}

function forward(n: Net, x: number[]) {
  const z = n.v0.map((b, j) => f(b + x[0] * n.v[0][j] + x[1] * n.v[1][j]));
  const y = f(n.w0 + z.reduce((s, zj, j) => s + zj * n.w[j], 0));
  return { z, y };
}

/** One epoch of per-pattern (online) backpropagation; returns the total squared error. */
function epoch(n: Net, alpha: number, mu: number): number {
  let E = 0;
  for (const { x, t } of DATA) {
    const { z, y } = forward(n, x);
    E += 0.5 * (t - y) ** 2;
    const dk = (t - y) * y * (1 - y); // δk = (t − y) f'(y_in)
    for (let j = 0; j < z.length; j++) {
      const dj = dk * n.w[j] * z[j] * (1 - z[j]); // δj = f'(z_in,j) Σ δk wjk
      n.dw[j] = alpha * dk * z[j] + mu * n.dw[j];
      for (let i = 0; i < 2; i++) {
        n.dv[i][j] = alpha * dj * x[i] + mu * n.dv[i][j];
        n.v[i][j] += n.dv[i][j];
      }
      n.dv0[j] = alpha * dj + mu * n.dv0[j];
      n.v0[j] += n.dv0[j];
      n.w[j] += n.dw[j];
    }
    n.dw0 = alpha * dk + mu * n.dw0;
    n.w0 += n.dw0;
  }
  return E;
}

export function BackpropLab() {
  const [p, setP] = useState(2);
  const [alpha, setAlpha] = useState(0.5);
  const [mu, setMu] = useState(0);
  const [mode, setMode] = useState<'random' | 'nw'>('random');
  const [seed, setSeed] = useState(3);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState({ n: 0, epochs: 0, E: NaN, solved: false });
  const net = useRef<Net>(init(2, 'random', 3));
  const hist = useRef<number[]>([]);
  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);

  // Snapshot what the readout needs: refs are only read here, outside render.
  const publish = useCallback(() => {
    const H = hist.current;
    setTick((t) => ({
      n: t.n + 1,
      epochs: H.length,
      E: H.length ? H[H.length - 1] : NaN,
      solved: DATA.every((d) => (forward(net.current, d.x).y >= 0.5 ? 1 : 0) === d.t),
    }));
  }, []);

  const reset = useCallback((pp = p, m = mode, s = seed) => {
    net.current = init(pp, m, s);
    hist.current = [];
    setRunning(false);
    publish();
  }, [p, mode, seed, publish]);

  const train = useCallback((k: number) => {
    for (let i = 0; i < k; i++) hist.current.push(epoch(net.current, alpha, mu));
    if (hist.current.length > 20000) hist.current = hist.current.slice(-20000);
    publish();
  }, [alpha, mu, publish]);

  useEffect(() => {
    if (!running) return;
    let id = 0;
    const loop = () => {
      train(40);
      const E = hist.current[hist.current.length - 1];
      if (E < 0.005 || hist.current.length >= 20000) { setRunning(false); return; }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running, train]);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card; ctx.fillRect(0, 0, w, h);
    const side = Math.min(h - 12, w * 0.48), ox = 6, oy = 6;
    const lo = -0.25, hi = 1.25, cell = 5;
    const X = (x: number) => ox + ((x - lo) / (hi - lo)) * side;
    const Y = (y: number) => oy + side - ((y - lo) / (hi - lo)) * side;
    for (let px = 0; px < side; px += cell)
      for (let py = 0; py < side; py += cell) {
        const x = lo + ((px + cell / 2) / side) * (hi - lo);
        const y = hi - ((py + cell / 2) / side) * (hi - lo);
        const out = forward(net.current, [x, y]).y;
        ctx.fillStyle = out >= 0.5 ? pal.mint : pal.pink;
        ctx.globalAlpha = 0.15 + 0.6 * Math.abs(out - 0.5);
        ctx.fillRect(ox + px, oy + py, cell, cell);
      }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, side, side);
    // hidden-unit lines: v0j + v1j x1 + v2j x2 = 0
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, side, side); ctx.clip();
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = pal.blue;
    const n = net.current;
    for (let j = 0; j < n.w.length; j++) {
      const a = n.v[0][j], b = n.v[1][j], c0 = n.v0[j];
      ctx.beginPath();
      if (Math.abs(b) > 1e-6) { ctx.moveTo(X(lo), Y((-c0 - a * lo) / b)); ctx.lineTo(X(hi), Y((-c0 - a * hi) / b)); }
      ctx.stroke();
    }
    ctx.restore(); ctx.setLineDash([]);
    ctx.font = 'bold 12px ui-monospace, monospace';
    for (const d of DATA) {
      const y = forward(n, d.x).y;
      ctx.fillStyle = d.t ? pal.mint : pal.pink; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X(d.x[0]), Y(d.x[1]), 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillText(String(d.t), X(d.x[0]) - 4, Y(d.x[1]) + 4);
      ctx.fillStyle = pal.ink; ctx.fillText(fmt(y, 2), X(d.x[0]) + 14, Y(d.x[1]) - 10);
    }
    // error curve (log scale)
    const H = hist.current, gx = ox + side + 26, gw = w - gx - 10, gy = oy + 18, gh = side - 40;
    ctx.fillStyle = pal.muted; ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('total squared error per epoch (log scale)', gx, oy + 10);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5; ctx.strokeRect(gx, gy, gw, gh);
    if (H.length > 1) {
      const lmin = Math.log10(1e-3), lmax = Math.log10(Math.max(...H.slice(0, 50), 0.6));
      ctx.strokeStyle = pal.blue; ctx.lineWidth = 2; ctx.beginPath();
      const stride = Math.max(1, Math.floor(H.length / 400));
      for (let i = 0; i < H.length; i += stride) {
        const px = gx + (i / (H.length - 1)) * gw;
        const py = gy + gh - ((Math.log10(Math.max(H[i], 1e-3)) - lmin) / (lmax - lmin)) * gh;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.fillText(`${H.length} epochs · E = ${fmt(H[H.length - 1], 4)}`, gx + 4, gy + gh + 14);
    }
  }, [tick, w, h, theme]);

  const { epochs, E, solved } = tick;
  return (
    <SimFrame
      title="Backpropagation learns XOR"
      hint="Dashed blue lines are the hidden units' own boundaries (v0j + v1j x1 + v2j x2 = 0): the hidden layer cuts the square with two lines and the output unit combines the strips - the XOR picture of Lesson 4. Plain backprop with 2 hidden units can sit on a plateau for thousands of epochs or stall in a local minimum (try other seeds). Momentum μ ≈ 0.9 and Nguyen–Widrow initialisation usually cut the time sharply; a large α makes the error curve jagged."
      controls={
        <>
          <Slider label="hidden units p" value={p} min={2} max={6} step={1} onChange={(v) => { setP(v); reset(v); }} />
          <Slider label="learning rate α" value={alpha} min={0.05} max={3} step={0.05} onChange={setAlpha} />
          <Slider label="momentum μ" value={mu} min={0} max={0.95} step={0.05} onChange={setMu} />
          <Select label="initial weights" value={mode} onChange={(m: 'random' | 'nw') => { setMode(m); reset(p, m); }} options={[{ value: 'random', label: 'Random in [−0.5, 0.5]' }, { value: 'nw', label: 'Nguyen–Widrow' }]} />
          <Select label="seed" value={String(seed)} onChange={(s) => { setSeed(Number(s)); reset(p, mode, Number(s)); }} options={[1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ value: String(k), label: String(k) }))} />
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm nb-btn-primary" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Train'}</button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => train(1)}>1 epoch</button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => reset()}>Reset</button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          {epochs} epochs · E = {Number.isFinite(E) ? fmt(E, 4) : '-'} · {solved ? <b>all four patterns on the right side of 0.5</b> : 'not solved yet'}
          {mode === 'nw' && <> · β = 0.7·p^(1/n) = {fmt(0.7 * Math.sqrt(p), 3)}</>}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="XOR decision region and training error" />
      </div>
    </SimFrame>
  );
}
