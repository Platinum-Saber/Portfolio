'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, palette, setupCanvas } from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * The restaurant tipping system of Examples 7.7 (Mamdani) and 7.9 (Tsukamoto),
 * with the notes' exact membership functions. Move the inputs and watch
 * fuzzification → firing strengths → implication → aggregation → defuzzification.
 */

const del = (x: number) => (x >= 5 && x <= 8 ? (x - 5) / 3 : x > 8 && x <= 10 ? (10 - x) / 2 : 0);
const poor = (y: number) => (y <= 5 ? 1 - y / 5 : 0);
const good = (y: number) => (y <= 5 ? y / 5 : 1);
// Mamdani output sets (eq. 7.28) on z ∈ [0, 20] %
const low = (z: number) => (z <= 10 ? 1 - z / 10 : 0);
const high = (z: number) => (z >= 10 ? (z - 10) / 10 : 0);
// Tsukamoto monotonic sets (eqs. 7.40–7.41)
const highT = (z: number) => z / 20;
const lowT = (z: number) => (20 - z) / 20;

type Method = 'mam-min' | 'mam-prod' | 'tsuk' | 'sugeno';
const LOW_C = 5, HIGH_C = 15; // zero-order Sugeno constants (illustration)

function infer(x: number, y: number, m: Method) {
  const mD = del(x), mND = 1 - mD, mP = poor(y), mG = good(y);
  const a1 = Math.max(mD, mG); // R1: Food is Delicious OR Service is Good → Tip High
  const a2 = Math.min(mND, mP); // R2: Food is NOT Delicious AND Service is Poor → Tip Low
  let out: (z: number) => number = () => 0;
  let z = NaN, mom = NaN, y1 = NaN, y2 = NaN;
  if (m === 'mam-min' || m === 'mam-prod') {
    const imp = m === 'mam-min' ? (a: number, v: number) => Math.min(a, v) : (a: number, v: number) => a * v;
    out = (t) => Math.max(imp(a1, high(t)), imp(a2, low(t)));
    let num = 0, den = 0, best = -1, lo = 0, hi = 0;
    const N = 4000;
    for (let i = 0; i <= N; i++) {
      const t = (20 * i) / N, mu = out(t);
      num += t * mu; den += mu;
      if (mu > best + 1e-9) { best = mu; lo = hi = t; } else if (Math.abs(mu - best) < 1e-9) hi = t;
    }
    z = den > 0 ? num / den : NaN;
    mom = (lo + hi) / 2;
  } else if (m === 'tsuk') {
    y1 = 20 * a1; // μHigh⁻¹(α1)
    y2 = 20 * (1 - a2); // μLow⁻¹(α2)
    z = a1 + a2 > 0 ? (a1 * y1 + a2 * y2) / (a1 + a2) : NaN;
  } else {
    y1 = HIGH_C; y2 = LOW_C;
    z = a1 + a2 > 0 ? (a1 * y1 + a2 * y2) / (a1 + a2) : NaN;
  }
  return { mD, mND, mP, mG, a1, a2, out, z, mom, y1, y2 };
}

export function FuzzyTipLab() {
  const [x, setX] = useState(7.5);
  const [y, setY] = useState(4);
  const [m, setM] = useState<Method>('mam-min');
  const r = useMemo(() => infer(x, y, m), [x, y, m]);
  const { wrap, w, h, theme } = useCanvasSize(0.36, 260);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card; ctx.fillRect(0, 0, w, h);
    const gap = 14, pw = (w - 4 * gap) / 3, top = 22, ph = h - top - 26;
    ctx.font = '11px ui-monospace, monospace';
    const panel = (k: number, title: string, x0: number, x1: number, curves: { f: (t: number) => number; col: string; label: string }[], marker?: number) => {
      const ox = gap + k * (pw + gap);
      const X = (t: number) => ox + ((t - x0) / (x1 - x0)) * pw;
      const Y = (v: number) => top + ph - v * ph;
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5; ctx.strokeRect(ox, top, pw, ph);
      ctx.fillStyle = pal.ink; ctx.fillText(title, ox, top - 7);
      ctx.fillStyle = pal.muted;
      ctx.fillText(String(x0), ox, top + ph + 13); ctx.fillText(String(x1), ox + pw - 16, top + ph + 13);
      curves.forEach(({ f, col, label }, ci) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let i = 0; i <= 200; i++) { const t = x0 + ((x1 - x0) * i) / 200; if (i) ctx.lineTo(X(t), Y(f(t))); else ctx.moveTo(X(t), Y(f(t))); }
        ctx.stroke();
        ctx.fillStyle = col; ctx.fillText(label, ox + 4 + ci * 80, top + 12);
      });
      if (marker !== undefined) {
        ctx.strokeStyle = pal.red; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(X(marker), top); ctx.lineTo(X(marker), top + ph); ctx.stroke(); ctx.setLineDash([]);
      }
      return { X, Y, ox };
    };
    panel(0, `food x = ${fmt(x, 1)}`, 0, 10, [
      { f: del, col: pal.blue, label: 'Delicious' },
      { f: (t) => 1 - del(t), col: pal.orange, label: 'NOT Del.' },
    ], x);
    panel(1, `service y = ${fmt(y, 1)}`, 0, 10, [
      { f: poor, col: pal.pink, label: 'Poor' },
      { f: good, col: pal.mint, label: 'Good' },
    ], y);
    const tsk = m === 'tsuk';
    const P = panel(2, 'tip z (%)', 0, 20, m === 'sugeno' ? [] : [
      { f: tsk ? lowT : low, col: pal.muted, label: 'Low' },
      { f: tsk ? highT : high, col: pal.muted, label: 'High' },
    ], Number.isFinite(r.z) ? r.z : undefined);
    if (m === 'mam-min' || m === 'mam-prod') {
      ctx.fillStyle = pal.yellow; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.moveTo(P.X(0), P.Y(0));
      for (let i = 0; i <= 300; i++) { const t = (20 * i) / 300; ctx.lineTo(P.X(t), P.Y(r.out(t))); }
      ctx.lineTo(P.X(20), P.Y(0)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // crisp rule outputs drawn as spikes of height α
      for (const [yy, a, col] of [[r.y1, r.a1, pal.mint], [r.y2, r.a2, pal.pink]] as [number, number, string][]) {
        ctx.strokeStyle = col; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(P.X(yy), P.Y(0)); ctx.lineTo(P.X(yy), P.Y(a)); ctx.stroke();
        ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(P.X(yy), P.Y(a), 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, [r, x, y, m, w, h, theme]);

  const methodNote: Record<Method, string> = {
    'mam-min': 'clip each consequent at its firing strength, take the max (union), then the centroid',
    'mam-prod': 'scale each consequent by its firing strength, take the max, then the centroid',
    tsuk: 'each rule gives a crisp value y_i = μ⁻¹(α_i) from its monotonic consequent; weighted average',
    sugeno: `zero-order TSK: rule outputs are constants (Low → ${LOW_C} %, High → ${HIGH_C} %); weighted average`,
  };
  return (
    <SimFrame
      title="Fuzzy inference - the tipping example, step by step"
      hint="R1: IF food is Delicious OR service is Good THEN tip is High (max). R2: IF food is NOT Delicious AND service is Poor THEN tip is Low (min). At the notes' inputs (7.5, 4) R1 fires at 0.833 and R2 at 0.167. Mamdani (min) then gives z* ≈ 13.72 %, and Tsukamoto gives 16.67 % - both rules happen to map to the same crisp value."
      controls={
        <>
          <Slider label="food quality x" value={x} min={0} max={10} step={0.1} onChange={setX} />
          <Slider label="service quality y" value={y} min={0} max={10} step={0.1} onChange={setY} />
          <Select label="inference" value={m} onChange={setM} options={[
            { value: 'mam-min', label: 'Mamdani - min (clip)' },
            { value: 'mam-prod', label: 'Mamdani - product (scale)' },
            { value: 'tsuk', label: 'Tsukamoto' },
            { value: 'sugeno', label: 'Sugeno (zero-order)' },
          ]} />
        </>
      }
      readout={
        <p className="nb-sim-stat">
          μDel = {fmt(r.mD, 3)} · μNOT Del = {fmt(r.mND, 3)} · μPoor = {fmt(r.mP, 3)} · μGood = {fmt(r.mG, 3)}
          <br />
          α₁ = max({fmt(r.mD, 3)}, {fmt(r.mG, 3)}) = <b>{fmt(r.a1, 3)}</b> · α₂ = min({fmt(r.mND, 3)}, {fmt(r.mP, 3)}) = <b>{fmt(r.a2, 3)}</b>
          {(m === 'tsuk' || m === 'sugeno') && <> · y₁ = {fmt(r.y1, 3)} · y₂ = {fmt(r.y2, 3)}</>}
          <br />
          tip z* = <b>{Number.isFinite(r.z) ? `${fmt(r.z, 2)} %` : 'no rule fires'}</b>
          {(m === 'mam-min' || m === 'mam-prod') && Number.isFinite(r.mom) && <> · mean of maxima {fmt(r.mom, 2)} %</>}
          {' · '}{methodNote[m]}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Input membership functions and aggregated output" />
      </div>
    </SimFrame>
  );
}

