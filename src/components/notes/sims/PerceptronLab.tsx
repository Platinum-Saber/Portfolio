'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, palette, setupCanvas } from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * Train a single neuron on a 2-input logic function, one pattern at a time,
 * with the perceptron rule (Lesson 2) or the delta / LMS rule (Lesson 3).
 * With bipolar AND, η = 1 and zero start it reproduces Lesson 2 Example 7
 * update for update. XOR never converges: no line separates it.
 */

type Gate = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR';
type Code = 'bipolar' | 'binary';
type Rule = 'perceptron' | 'delta';
const TRUTH: Record<Gate, (a: number, b: number) => number> = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  NAND: (a, b) => 1 - (a & b),
  NOR: (a, b) => 1 - (a | b),
  XOR: (a, b) => a ^ b,
};

type W = { w1: number; w2: number; b: number };
type Row = { ep: number; p: number; yin: number; y: number; t: number; upd: boolean; w: W };
type St = { w: W; k: number; ep: number; errs: number; clean: number; rows: Row[]; mse: number[]; sq: number };

const fresh = (): St => ({ w: { w1: 0, w2: 0, b: 0 }, k: 0, ep: 1, errs: 0, clean: 0, rows: [], mse: [], sq: 0 });

function patterns(g: Gate, code: Code) {
  const raw = [[0, 0], [0, 1], [1, 0], [1, 1]];
  return raw.map(([a, b]) => {
    const t = TRUTH[g](a, b);
    return code === 'bipolar'
      ? { x1: 2 * a - 1, x2: 2 * b - 1, t: 2 * t - 1 }
      : { x1: a, x2: b, t };
  });
}

function step(s: St, P: ReturnType<typeof patterns>, code: Code, rule: Rule, eta: number): St {
  const p = P[s.k];
  const { w1, w2, b } = s.w;
  const yin = w1 * p.x1 + w2 * p.x2 + b;
  // Lesson 2: binary y = 1 if yin ≥ 0; Example 7 (bipolar): y = +1 if yin > 0.
  const y = code === 'bipolar' ? (yin > 0 ? 1 : -1) : yin >= 0 ? 1 : 0;
  let nw = s.w;
  let upd = false;
  if (rule === 'perceptron') {
    if (y !== p.t) {
      // bipolar: w += η t x (Example 7); binary: w += η (t − y) x (eq. 6).
      const e = code === 'bipolar' ? p.t : p.t - y;
      nw = { w1: w1 + eta * e * p.x1, w2: w2 + eta * e * p.x2, b: b + eta * e };
      upd = true;
    }
  } else {
    const e = p.t - yin; // delta rule: error on the LINEAR output
    nw = { w1: w1 + eta * e * p.x1, w2: w2 + eta * e * p.x2, b: b + eta * e };
    upd = Math.abs(e) > 1e-9;
  }
  const wrong = y !== p.t;
  const sq = s.sq + (p.t - yin) ** 2;
  const row: Row = { ep: s.ep, p: s.k + 1, yin, y, t: p.t, upd, w: nw };
  const last = s.k === P.length - 1;
  const errs = s.errs + (wrong ? 1 : 0);
  return {
    w: nw,
    k: last ? 0 : s.k + 1,
    ep: last ? s.ep + 1 : s.ep,
    errs: last ? 0 : errs,
    clean: last ? (errs === 0 ? s.clean + 1 : 0) : s.clean,
    rows: [...s.rows, row].slice(-40),
    mse: last ? [...s.mse, sq / P.length] : s.mse,
    sq: last ? 0 : sq,
  };
}

export function PerceptronLab() {
  const [gate, setGate] = useState<Gate>('AND');
  const [code, setCode] = useState<Code>('bipolar');
  const [rule, setRule] = useState<Rule>('perceptron');
  const [eta, setEta] = useState(1);
  const [s, setS] = useState<St>(fresh);
  const P = useMemo(() => patterns(gate, code), [gate, code]);
  const { wrap, w, h, theme } = useCanvasSize(0.62, 330);
  const cv = useRef<HTMLCanvasElement>(null);

  const reset = () => setS(fresh());
  const converged = rule === 'perceptron' ? s.clean >= 1 : false;
  const epoch = () => {
    let x = s;
    do x = step(x, P, code, rule, eta); while (x.k !== 0);
    setS(x);
  };
  const run = () => {
    let x = s;
    for (let i = 0; i < 4 * 100; i++) {
      x = step(x, P, code, rule, eta);
      if (rule === 'perceptron' && x.clean >= 1) break;
    }
    setS(x);
  };

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const side = Math.min(h, w * 0.55);
    const ox = 6, oy = (h - side) / 2;
    const lo = code === 'bipolar' ? -1.6 : -0.6, hi = 1.6;
    const X = (x: number) => ox + ((x - lo) / (hi - lo)) * side;
    const Y = (y: number) => oy + side - ((y - lo) / (hi - lo)) * side;
    ctx.fillStyle = pal.card; ctx.fillRect(0, 0, w, h);
    // shade the +1 half-plane
    const { w1, w2, b } = s.w;
    const cell = 6;
    for (let px = 0; px < side; px += cell)
      for (let py = 0; py < side; py += cell) {
        const x = lo + ((px + cell / 2) / side) * (hi - lo);
        const y = hi - ((py + cell / 2) / side) * (hi - lo);
        const v = w1 * x + w2 * y + b;
        ctx.fillStyle = v > 0 || (code === 'binary' && v >= 0) ? pal.mint : pal.pink;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(ox + px, oy + py, cell, cell);
      }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, side, side);
    // axes
    ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(X(0), oy); ctx.lineTo(X(0), oy + side); ctx.moveTo(ox, Y(0)); ctx.lineTo(ox + side, Y(0)); ctx.stroke();
    ctx.globalAlpha = 1;
    // decision boundary w1 x1 + w2 x2 + b = 0
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, side, side); ctx.clip();
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 3;
    ctx.beginPath();
    if (Math.abs(w2) > 1e-9) {
      ctx.moveTo(X(lo), Y((-b - w1 * lo) / w2)); ctx.lineTo(X(hi), Y((-b - w1 * hi) / w2));
    } else if (Math.abs(w1) > 1e-9) {
      ctx.moveTo(X(-b / w1), Y(lo)); ctx.lineTo(X(-b / w1), Y(hi));
    }
    ctx.stroke(); ctx.restore();
    // patterns
    ctx.font = 'bold 12px ui-monospace, monospace';
    P.forEach((p, i) => {
      const yin = w1 * p.x1 + w2 * p.x2 + b;
      const y = code === 'bipolar' ? (yin > 0 ? 1 : -1) : yin >= 0 ? 1 : 0;
      const pos = p.t === 1;
      ctx.fillStyle = pos ? pal.mint : pal.pink; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X(p.x1), Y(p.x2), 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (y !== p.t) { ctx.strokeStyle = pal.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(p.x1), Y(p.x2), 16, 0, Math.PI * 2); ctx.stroke(); }
      if (i === s.k) { ctx.strokeStyle = pal.blue; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(X(p.x1), Y(p.x2), 20, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = '#111'; ctx.fillText(pos ? '+' : '−', X(p.x1) - 4, Y(p.x2) + 4);
    });
    // MSE per epoch, right-hand panel
    const gx = ox + side + 24, gw = w - gx - 8, gy = oy + 16, gh = side - 36;
    ctx.fillStyle = pal.muted; ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(rule === 'delta' ? 'mean squared error per epoch (linear output)' : 'mean squared error of yin per epoch', gx, oy + 8);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5; ctx.strokeRect(gx, gy, gw, gh);
    if (s.mse.length) {
      const mx = Math.max(...s.mse, 1e-6);
      ctx.strokeStyle = pal.blue; ctx.lineWidth = 2.5; ctx.beginPath();
      s.mse.forEach((m, i) => {
        const px = gx + (s.mse.length === 1 ? 0 : (i / (s.mse.length - 1)) * gw);
        const py = gy + gh - (m / mx) * gh;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.fillText(`epoch ${s.mse.length}: ${fmt(s.mse[s.mse.length - 1], 3)}`, gx + 4, gy + gh + 14);
    }
  }, [s, P, code, rule, w, h, theme]);

  const pick = <T,>(set: (v: T) => void) => (v: T) => { set(v); reset(); };
  return (
    <SimFrame
      title="Perceptron vs delta rule - train a neuron on a logic gate"
      hint="Step presents one pattern. The perceptron changes weights only when a pattern is misclassified; the delta (LMS) rule changes them on every pattern, by how far the LINEAR output yin is from the target - so it keeps creeping towards the least-squares line even after every point is classified correctly. Try XOR: the perceptron cycles for ever, and LMS settles on a line that is right for only some points."
      controls={
        <>
          <Select label="function" value={gate} onChange={pick(setGate)} options={(Object.keys(TRUTH) as Gate[]).map((g) => ({ value: g, label: g }))} />
          <Select label="coding" value={code} onChange={pick(setCode)} options={[{ value: 'bipolar', label: 'Bipolar (±1)' }, { value: 'binary', label: 'Binary (0/1)' }]} />
          <Select label="learning rule" value={rule} onChange={(v: Rule) => { setRule(v); setEta(v === 'delta' ? 0.1 : 1); reset(); }} options={[{ value: 'perceptron', label: 'Perceptron rule' }, { value: 'delta', label: 'Delta / LMS (ADALINE)' }]} />
          <Slider label="learning rate η" value={eta} min={0.05} max={1} step={0.05} onChange={(v) => { setEta(v); reset(); }} />
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setS(step(s, P, code, rule, eta))}>Step</button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={epoch}>Epoch</button>
            <button type="button" className="nb-btn nb-btn-sm nb-btn-primary" onClick={run}>{rule === 'perceptron' ? 'Run to convergence' : 'Run 100 epochs'}</button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={reset}>Reset</button>
          </div>
        </>
      }
      readout={
        <>
          <p className="nb-sim-stat">
            w₁ = <b>{fmt(s.w.w1, 3)}</b> · w₂ = <b>{fmt(s.w.w2, 3)}</b> · b = <b>{fmt(s.w.b, 3)}</b> · epoch {s.ep}, pattern {s.k + 1} next
            {rule === 'perceptron' && (converged ? <b> · converged: a full epoch with no errors</b> : s.ep > 30 ? <b> · not converging - is the data linearly separable?</b> : '')}
          </p>
          <div className="nb-table-scroll nb-sim-log">
            <table>
              <thead>
                <tr><th>epoch</th><th>pattern</th><th>yin</th><th>y</th><th>t</th><th>update</th><th>w₁, w₂, b after</th></tr>
              </thead>
              <tbody>
                {s.rows.slice(-6).map((r, i) => (
                  <tr key={i} data-upd={r.upd || undefined}>
                    <td>{r.ep}</td><td>{r.p}</td><td>{fmt(r.yin, 3)}</td><td>{r.y}</td><td>{r.t}</td>
                    <td>{r.upd ? 'yes' : '-'}</td>
                    <td>{fmt(r.w.w1, 3)}, {fmt(r.w.w2, 3)}, {fmt(r.w.b, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Input space with decision boundary" />
      </div>
    </SimFrame>
  );
}
