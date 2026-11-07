'use client';

import { useEffect, useRef, useState } from 'react';
import { fmt, palette, setupCanvas } from './canvas';
import { SimFrame, Slider, useCanvasSize } from './SimFrame';

/** Speedup = 1 / ((1 − p) + p/n) against core count, on a log2 axis, with its ceiling. */
export function AmdahlLab() {
  const [p, setP] = useState(0.95);
  const [n, setN] = useState(16);
  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);
  const S = (pp: number, nn: number) => 1 / (1 - pp + pp / nn);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    const L = 38, B = 26, R = 22, T = 14, maxN = 1024, maxS = 64;
    const X = (nn: number) => L + (Math.log2(nn) / Math.log2(maxN)) * (w - L - R);
    const Y = (s: number) => h - B - (Math.log2(s) / Math.log2(maxS)) * (h - B - T);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = pal.muted;
    ctx.strokeStyle = pal.ink;
    for (let k = 0; k <= 10; k += 2) {
      const x = X(2 ** k);
      ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, h - B); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(String(2 ** k), x - (k === 10 ? 26 : 6), h - 8);
    }
    for (let k = 0; k <= 6; k++) {
      const y = Y(2 ** k);
      ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(`${2 ** k}×`, 4, y + 4);
    }
    // ideal (linear) speedup
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(1), Y(1)); ctx.lineTo(X(maxS), Y(maxS)); ctx.stroke();
    ctx.setLineDash([]);
    const curve = (pp: number, col: string, width: number) => {
      ctx.strokeStyle = col; ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const nn = 2 ** ((i / 200) * Math.log2(maxN));
        const y = Y(Math.min(maxS, S(pp, nn)));
        if (i) ctx.lineTo(X(nn), y); else ctx.moveTo(X(nn), y);
      }
      ctx.stroke();
    };
    [0.5, 0.9, 0.99].forEach((pp) => {
      ctx.globalAlpha = 0.45; curve(pp, pal.muted, 2); ctx.globalAlpha = 1;
      ctx.fillStyle = pal.muted;
      ctx.fillText(`p=${pp}`, X(300), Y(Math.min(maxS, S(pp, 300))) - 6);
    });
    // ceiling for the chosen p
    const ceil = 1 / (1 - p);
    if (ceil < maxS) {
      ctx.strokeStyle = pal.red; ctx.setLineDash([3, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L, Y(ceil)); ctx.lineTo(w - R, Y(ceil)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.ink;
      ctx.fillText(`ceiling 1/(1−p) = ${fmt(ceil, 1)}×`, L + 6, Y(ceil) - 5);
    }
    ctx.lineWidth = 5; ctx.strokeStyle = pal.ink; curve(p, pal.ink, 5);
    curve(p, pal.blue, 3);
    const s = S(p, n);
    ctx.fillStyle = pal.yellow; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(X(n), Y(Math.min(maxS, s)), 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }, [p, n, w, h, theme]);

  const s = S(p, n);
  return (
    <SimFrame
      title="Amdahl's law - the serial part sets the ceiling"
      hint="Blue: your p. Grey: p = 0.5, 0.9, 0.99. Dashed: ideal linear speedup. The red line is the ceiling 1/(1−p): with 5% serial code no number of cores beats 20×."
      controls={
        <>
          <Slider label="parallel fraction p" value={p} min={0.5} max={0.999} step={0.001} onChange={setP} format={(x) => fmt(x, 3)} />
          <Slider label="cores n" value={Math.log2(n)} min={0} max={10} step={1} onChange={(k) => setN(2 ** k)} format={() => String(n)} />
        </>
      }
      readout={
        <p className="nb-sim-stat">
          S({n}) = 1 / ({fmt(1 - p, 3)} + {fmt(p, 3)}/{n}) = <b>{fmt(s, 2)}×</b> · efficiency S/n = <b>{fmt(s / n, 2)}</b> ·
          ceiling <b>{fmt(1 / (1 - p), 1)}×</b> · cores to reach half the ceiling ≈ {fmt(p / (1 - p), 0)}
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Speedup against number of cores" />
      </div>
    </SimFrame>
  );
}
