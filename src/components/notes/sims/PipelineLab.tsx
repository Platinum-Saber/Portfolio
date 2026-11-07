'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, palette, setupCanvas } from './canvas';
import { SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * A three-stage pipeline (read → process → write) like Lab 6 Ex3. Each stage
 * has its own worker count; items flow FIFO through bounded hand-offs. The
 * slowest stage (time / workers) sets the throughput.
 */

const ITEMS = 12;
const NAMES = ['read', 'process', 'write'];

function simulate(t: number[], n: number[]) {
  const rows: { stage: number; worker: number; item: number; s: number; e: number }[] = [];
  const prevDone = Array(ITEMS).fill(0);
  for (let k = 0; k < 3; k++) {
    const free = Array(n[k]).fill(0);
    // Items leave a stage in order of completion; process them FIFO by ready time.
    const order = [...Array(ITEMS).keys()].sort((a, b) => prevDone[a] - prevDone[b] || a - b);
    const done = Array(ITEMS).fill(0);
    for (const i of order) {
      const wk = free.indexOf(Math.min(...free));
      const s = Math.max(free[wk], prevDone[i]);
      const e = s + t[k];
      rows.push({ stage: k, worker: wk, item: i, s, e });
      free[wk] = e;
      done[i] = e;
    }
    for (let i = 0; i < ITEMS; i++) prevDone[i] = done[i];
  }
  const makespan = Math.max(...prevDone);
  const serial = ITEMS * (t[0] + t[1] + t[2]);
  const per = t.map((x, k) => x / n[k]);
  const bottleneck = per.indexOf(Math.max(...per));
  return { rows, makespan, serial, bottleneck, per };
}

export function PipelineLab() {
  const [t, setT] = useState([1, 4, 1]);
  const [n, setN] = useState([1, 1, 1]);
  const { wrap, w, h, theme } = useCanvasSize(0.45, 320);
  const cv = useRef<HTMLCanvasElement>(null);
  const res = useMemo(() => simulate(t, n), [t, n]);

  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    const ctx = setupCanvas(el, w, h);
    const pal = palette(el);
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    const lanes: [number, number][] = [];
    for (let k = 0; k < 3; k++) for (let j = 0; j < n[k]; j++) lanes.push([k, j]);
    const L = 74, top = 6, bot = 20;
    const laneH = (h - top - bot) / lanes.length;
    const tMax = ITEMS * (t[0] + t[1] + t[2]) * 0.75;
    const X = (x: number) => L + (Math.min(x, tMax) / tMax) * (w - L - 8);
    const cols = [pal.mint, pal.yellow, pal.pink, pal.blue, pal.orange, pal.red];
    ctx.font = '10px ui-monospace, monospace';
    lanes.forEach(([k, j], li) => {
      const y = top + li * laneH;
      ctx.fillStyle = k === res.bottleneck ? pal.red : pal.ink;
      ctx.fillText(`${NAMES[k]}${n[k] > 1 ? ` #${j + 1}` : ''}`, 4, y + laneH / 2 + 4);
      if (j === 0 && k) {
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (const r of res.rows.filter((r) => r.stage === k && r.worker === j)) {
        ctx.fillStyle = cols[r.item % cols.length];
        const x0 = X(r.s), x1 = X(r.e);
        ctx.fillRect(x0, y + 2, Math.max(1, x1 - x0), laneH - 4);
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2;
        ctx.strokeRect(x0, y + 2, Math.max(1, x1 - x0), laneH - 4);
        if (x1 - x0 > 14 && laneH > 12) {
          ctx.fillStyle = '#111';
          ctx.fillText(String(r.item), x0 + 3, y + laneH / 2 + 4);
        }
      }
    });
    ctx.strokeStyle = pal.red; ctx.setLineDash([4, 3]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(res.makespan), 0); ctx.lineTo(X(res.makespan), h - bot); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = pal.ink;
    ctx.fillText(`all ${ITEMS} items done at ${fmt(res.makespan, 1)}`, Math.min(X(res.makespan) + 4, w - 150), h - 6);
  }, [res, t, n, w, h, theme]);

  const upd = (arr: number[], k: number, v: number) => arr.map((x, i) => (i === k ? v : x));
  return (
    <SimFrame
      title="Pipeline - the slowest stage sets the pace"
      hint="Each coloured box is one item in one stage. With one worker per stage, 'process' (4 units) is the bottleneck and the read/write threads mostly wait. Give the bottleneck stage a second worker and throughput nearly doubles - the Lab 6 Ex3 result (0.97× → 1.73×). Adding workers to a non-bottleneck stage changes nothing."
      controls={
        <>
          {NAMES.map((nm, k) => (
            <Slider key={`t${k}`} label={`${nm} time`} value={t[k]} min={0.5} max={6} step={0.5} onChange={(v) => setT(upd(t, k, v))} />
          ))}
          {NAMES.map((nm, k) => (
            <Slider key={`n${k}`} label={`${nm} workers`} value={n[k]} min={1} max={4} step={1} onChange={(v) => setN(upd(n, k, v))} />
          ))}
        </>
      }
      readout={
        <p className="nb-sim-stat">
          serial {fmt(res.serial, 1)} → pipelined <b>{fmt(res.makespan, 1)}</b> · speedup <b>{fmt(res.serial / res.makespan, 2)}×</b> ·
          bottleneck <b>{NAMES[res.bottleneck]}</b> (one item every {fmt(res.per[res.bottleneck], 2)}) · steady-state limit ≈{' '}
          {fmt((t[0] + t[1] + t[2]) / res.per[res.bottleneck], 2)}×
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Pipeline timeline per stage worker" />
      </div>
    </SimFrame>
  );
}
