'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, palette, rng, setupCanvas } from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * OpenMP `schedule(...)` as a Gantt chart: N loop iterations with a chosen cost
 * profile, T threads. Static deals blocks out up front; dynamic and guided hand
 * out chunks to whichever thread is free (paying a small grab overhead).
 */

type Work = 'uniform' | 'triangle' | 'mandel' | 'spiky';
type Sched = 'static' | 'staticChunk' | 'dynamic' | 'guided';
const N = 96;
const OVERHEAD = 0.15; // cost of one trip to the shared counter, in "iteration units"

function costs(work: Work): number[] {
  const r = rng(11);
  return Array.from({ length: N }, (_, i) => {
    const x = i / (N - 1);
    switch (work) {
      case 'uniform': return 1;
      case 'triangle': return 0.1 + 2 * x;
      case 'mandel': return 0.2 + 2.4 * Math.exp(-((x - 0.5) ** 2) / 0.02);
      case 'spiky': return r.u() < 0.08 ? 6 : 0.5;
    }
  });
}

type Block = { t: number; s: number; e: number; from: number; to: number; k: number };

function simulate(c: number[], T: number, sched: Sched, chunk: number) {
  const blocks: Block[] = [];
  const free = Array(T).fill(0);
  const run = (t: number, from: number, to: number, k: number, extra = 0) => {
    let d = extra;
    for (let i = from; i < to; i++) d += c[i];
    blocks.push({ t, s: free[t], e: free[t] + d, from, to, k });
    free[t] += d;
  };
  if (sched === 'static') {
    const per = Math.ceil(N / T);
    for (let t = 0; t < T; t++) {
      const a = t * per, b = Math.min(N, a + per);
      if (a < b) run(t, a, b, t);
    }
  } else if (sched === 'staticChunk') {
    let k = 0;
    for (let a = 0; a < N; a += chunk, k++) run(k % T, a, Math.min(N, a + chunk), k);
  } else {
    let next = 0, k = 0;
    while (next < N) {
      const t = free.indexOf(Math.min(...free));
      const size = sched === 'dynamic' ? chunk : Math.max(chunk, Math.ceil((N - next) / T));
      const b = Math.min(N, next + size);
      run(t, next, b, k++, OVERHEAD);
      next = b;
    }
  }
  const total = c.reduce((a, b) => a + b, 0);
  return { blocks, makespan: Math.max(...free), ideal: total / T, grabs: blocks.length, busy: free };
}

export function ScheduleLab() {
  const [work, setWork] = useState<Work>('mandel');
  const [sched, setSched] = useState<Sched>('static');
  const [T, setT] = useState(4);
  const [chunk, setChunk] = useState(4);
  const { wrap, w, h, theme } = useCanvasSize(0.42, 300);
  const cv = useRef<HTMLCanvasElement>(null);
  const c = useMemo(() => costs(work), [work]);
  const res = useMemo(() => simulate(c, T, sched, chunk), [c, T, sched, chunk]);
  // Fixed time axis for a workload, so switching schedules compares fairly.
  const axisMax = useMemo(() => c.reduce((a, b) => a + b, 0) * 0.6, [c]);

  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const ctx = setupCanvas(el, w, h);
    const pal = palette(el);
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    const L = 34, top = 34, bot = 34;
    const rowH = (h - top - bot) / T;
    const X = (t: number) => L + (Math.min(t, axisMax) / axisMax) * (w - L - 10);
    // cost profile strip
    const maxC = Math.max(...c);
    ctx.fillStyle = pal.muted;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('cost/iter', 2, 12);
    for (let i = 0; i < N; i++) {
      const bw = (w - L - 10) / N;
      const bh = (c[i] / maxC) * 22;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(L + i * bw, 26 - bh, Math.max(1, bw - 0.5), bh);
      ctx.globalAlpha = 1;
    }
    const cols = [pal.mint, pal.yellow, pal.pink, pal.blue, pal.orange];
    for (const b of res.blocks) {
      const y = top + b.t * rowH + 3;
      ctx.fillStyle = cols[b.k % cols.length];
      ctx.fillRect(X(b.s), y, Math.max(1, X(b.e) - X(b.s)), rowH - 6);
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5;
      ctx.strokeRect(X(b.s), y, Math.max(1, X(b.e) - X(b.s)), rowH - 6);
    }
    ctx.fillStyle = pal.ink;
    ctx.font = '11px ui-monospace, monospace';
    for (let t = 0; t < T; t++) ctx.fillText(`T${t}`, 6, top + t * rowH + rowH / 2 + 4);
    // ideal and makespan markers
    const mark = (x: number, col: string, label: string, dy: number) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, top - 2); ctx.lineTo(x, h - bot); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.ink; ctx.fillText(label, Math.min(x + 3, w - 90), h - 6 - dy);
    };
    mark(X(res.ideal), pal.blue, `ideal ${fmt(res.ideal, 1)}`, 0);
    mark(X(res.makespan), pal.red, `done ${fmt(res.makespan, 1)}`, Math.abs(X(res.makespan) - X(res.ideal)) < 90 ? 12 : 0);
  }, [res, c, T, w, h, theme, axisMax]);

  const imbalance = res.makespan / res.ideal;
  return (
    <SimFrame
      title="OpenMP loop scheduling - who finishes last?"
      hint="Static splits the iteration space into equal blocks before the loop starts: perfect for uniform work, bad when the cost is lumpy (the Mandelbrot centre). Dynamic hands out small chunks on demand and balances, but every grab costs a trip to a shared counter. Guided starts with big chunks and shrinks them - fewer grabs, still balanced."
      controls={
        <>
          <Select label="Work per iteration" value={work} onChange={setWork} options={[
            { value: 'uniform', label: 'Uniform' },
            { value: 'triangle', label: 'Growing (triangular loop)' },
            { value: 'mandel', label: 'Mandelbrot-like bump' },
            { value: 'spiky', label: 'Rare heavy tasks' },
          ]} />
          <Select label="schedule(...)" value={sched} onChange={setSched} options={[
            { value: 'static', label: 'static' },
            { value: 'staticChunk', label: 'static, chunk' },
            { value: 'dynamic', label: 'dynamic, chunk' },
            { value: 'guided', label: 'guided, chunk' },
          ]} />
          <Slider label="threads" value={T} min={2} max={8} step={1} onChange={setT} />
          <Slider label="chunk" value={chunk} min={1} max={24} step={1} onChange={setChunk} />
        </>
      }
      readout={
        <p className="nb-sim-stat">
          finish time <b>{fmt(res.makespan, 1)}</b> vs perfect balance {fmt(res.ideal, 1)} → load imbalance <b>{fmt(imbalance, 2)}×</b> ·
          chunks handed out {res.grabs}
          {sched === 'dynamic' || sched === 'guided' ? ` (overhead ${fmt(res.grabs * OVERHEAD, 1)})` : ' (decided at compile/loop entry, no overhead)'}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Gantt chart of loop iterations per thread" />
      </div>
    </SimFrame>
  );
}
