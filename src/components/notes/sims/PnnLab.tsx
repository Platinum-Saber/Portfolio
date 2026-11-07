'use client';

import { useEffect, useRef, useState } from 'react';
import { fmt, palette, setupCanvas } from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * A probabilistic neural network on two classes in 2-D: every stored sample is
 * a Gaussian "bump" (pattern layer), each class averages its bumps (summation
 * layer), and the Bayes rule h_A C_A f_A > h_B C_B f_B picks the class.
 * Click to add training samples - training is just storing them.
 */

type Pt = { x: number; y: number; c: 0 | 1 };
const START: Pt[] = [
  { x: 0.25, y: 0.3, c: 0 }, { x: 0.35, y: 0.55, c: 0 }, { x: 0.2, y: 0.7, c: 0 }, { x: 0.45, y: 0.35, c: 0 }, { x: 0.8, y: 0.85, c: 0 },
  { x: 0.65, y: 0.6, c: 1 }, { x: 0.75, y: 0.35, c: 1 }, { x: 0.6, y: 0.25, c: 1 }, { x: 0.85, y: 0.55, c: 1 }, { x: 0.5, y: 0.8, c: 1 },
];

function dens(px: number, py: number, pts: Pt[], c: 0 | 1, s: number) {
  let sum = 0, n = 0;
  for (const p of pts) if (p.c === c) { sum += Math.exp(-((px - p.x) ** 2 + (py - p.y) ** 2) / (2 * s * s)); n++; }
  return n ? sum / (n * 2 * Math.PI * s * s) : 0; // (2π)^(d/2) σ^d with d = 2
}

export function PnnLab() {
  const [pts, setPts] = useState<Pt[]>(START);
  const [s, setS] = useState(0.1);
  const [ratio, setRatio] = useState(1);
  const [cls, setCls] = useState<0 | 1>(0);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>({ x: 0.55, y: 0.5 });
  const { wrap, w, h, theme } = useCanvasSize(0.6, 340);
  const cv = useRef<HTMLCanvasElement>(null);
  const side = Math.min(h, w * 0.62);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card; ctx.fillRect(0, 0, w, h);
    const cell = 5;
    for (let px = 0; px < side; px += cell)
      for (let py = 0; py < side; py += cell) {
        const x = (px + cell / 2) / side, y = 1 - (py + cell / 2) / side;
        const a = ratio * dens(x, y, pts, 0, s), b = dens(x, y, pts, 1, s);
        const conf = Math.abs(a - b) / (a + b + 1e-12);
        ctx.fillStyle = a > b ? pal.blue : pal.orange;
        ctx.globalAlpha = 0.12 + 0.55 * conf;
        ctx.fillRect(px, py, cell, cell);
      }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 2; ctx.strokeRect(0, 0, side, side);
    for (const p of pts) {
      ctx.fillStyle = p.c === 0 ? pal.blue : pal.orange; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2;
      ctx.beginPath();
      if (p.c === 0) ctx.arc(p.x * side, (1 - p.y) * side, 7, 0, Math.PI * 2);
      else ctx.rect(p.x * side - 6, (1 - p.y) * side - 6, 12, 12);
      ctx.fill(); ctx.stroke();
    }
    if (probe) {
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(probe.x * side - 9, (1 - probe.y) * side); ctx.lineTo(probe.x * side + 9, (1 - probe.y) * side);
      ctx.moveTo(probe.x * side, (1 - probe.y) * side - 9); ctx.lineTo(probe.x * side, (1 - probe.y) * side + 9); ctx.stroke();
    }
    // network picture on the right: summation units
    const gx = side + 20, gw = w - gx - 6;
    if (gw > 120 && probe) {
      const fa = dens(probe.x, probe.y, pts, 0, s), fb = dens(probe.x, probe.y, pts, 1, s);
      const mx = Math.max(ratio * fa, fb, 1e-9);
      ctx.font = '11px ui-monospace, monospace'; ctx.fillStyle = pal.ink;
      ctx.fillText('at the probe (+):', gx, 18);
      const bar = (y: number, v: number, col: string, label: string) => {
        ctx.fillStyle = col; ctx.fillRect(gx, y, (v / mx) * (gw - 10), 16);
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5; ctx.strokeRect(gx, y, (v / mx) * (gw - 10), 16);
        ctx.fillStyle = pal.ink; ctx.fillText(label, gx, y + 30);
      };
      bar(30, ratio * fa, pal.blue, `hA·CA·f̂A = ${fmt(ratio * fa, 3)}`);
      bar(80, fb, pal.orange, `hB·CB·f̂B = ${fmt(fb, 3)}`);
      ctx.fillText(`→ class ${ratio * fa > fb ? 'A (circles)' : 'B (squares)'}`, gx, 140);
    }
  }, [pts, s, ratio, probe, side, w, h, theme]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / side, y = 1 - (e.clientY - r.top) / side;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (e.shiftKey) setProbe({ x, y }); else setPts([...pts, { x, y, c: cls }]);
  };

  return (
    <SimFrame
      title="Probabilistic neural network - Parzen windows as a network"
      hint="Each stored sample adds a Gaussian bump; a class's density is the average of its bumps. Small σ: the boundary wraps tightly round individual points (over-fitting - note the isolated blue island round the stray circle). Large σ: everything is smoothed and the boundary becomes almost a straight line (over-smoothing). The ratio slider is (h_A C_A)/(h_B C_B): raising the prior or the cost of missing class A grows A's region. Click to store a new sample; shift-click to move the probe."
      controls={
        <>
          <Slider label="smoothing σ" value={s} min={0.02} max={0.4} step={0.01} onChange={setS} />
          <Slider label="prior × cost ratio A : B" value={ratio} min={0.25} max={4} step={0.25} onChange={setRatio} />
          <Select label="click adds" value={String(cls)} onChange={(v) => setCls(v === '0' ? 0 : 1)} options={[{ value: '0', label: 'class A (circle)' }, { value: '1', label: 'class B (square)' }]} />
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setPts(START)}>Reset samples</button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          {pts.length} pattern units ({pts.filter((p) => p.c === 0).length} A, {pts.filter((p) => p.c === 1).length} B) · 2 summation units · training cost: store the sample, nothing else
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h, cursor: 'crosshair' }} onClick={onClick} role="img" aria-label="PNN decision regions" />
      </div>
    </SimFrame>
  );
}
