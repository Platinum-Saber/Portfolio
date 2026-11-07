'use client';

import { useEffect, useRef, useState } from 'react';
import {
  axes,
  fmt,
  palette,
  setupCanvas,
  ticks,
  toPx,
  type View,
} from './canvas';
import { SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * min x  s.t.  x ≥ 1.   Penalty:  x + ρ·max(1 − x, 0)²  → x = 1 − 1/(2ρ)  (from outside).
 * Barrier: x − (1/t)·log(x − 1)  → x = 1 + 1/t  (from inside), gap exactly m/t = 1/t.
 * Augmented Lagrangian on min x² s.t. x = 1:  x = (ρ − ν)/(2 + ρ), ν ← ν + ρ(x − 1).
 */
export function PenaltyBarrierLab() {
  const [rho, setRho] = useState(2);
  const [t, setT] = useState(2);
  const [alRho, setAlRho] = useState(1);
  const xp = 1 - 1 / (2 * rho);
  const xb = 1 + 1 / t;

  const al: { k: number; x: number; nu: number }[] = [];
  let nu = 0;
  for (let k = 0; k < 10; k++) {
    const x = (alRho - nu) / (2 + alRho);
    al.push({ k, x, nu });
    nu = nu + alRho * (x - 1);
  }

  const { wrap, w, h, theme } = useCanvasSize(0.5, 320);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    const v: View = { x0: 0, x1: 3, y0: 0, y1: 4, w, h };
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, w, h);
    const [fx] = toPx(v, 1, 0);
    ctx.fillStyle = pal.pink;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, 0, fx, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.ink;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText('infeasible', 8, 18);
    ctx.fillText('feasible  x ≥ 1', fx + 8, 18);
    axes(ctx, v, pal, ticks(0, 3, 6), ticks(0, 4, 4));
    ctx.fillRect(fx - 1.5, 0, 3, h);

    const curve = (
      fn: (x: number) => number,
      col: string,
      dash: number[] = [],
      a = 0,
      b = 3,
    ) => {
      ctx.setLineDash(dash);
      ctx.lineWidth = dash.length ? 0 : 6;
      ctx.strokeStyle = pal.ink;
      const path = () => {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 400; i++) {
          const x = a + ((b - a) * i) / 400;
          const y = fn(x);
          if (!Number.isFinite(y) || y > 6) {
            started = false;
            continue;
          }
          const [px, py] = toPx(v, x, y);
          if (started) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
          started = true;
        }
      };
      if (!dash.length) {
        path();
        ctx.stroke();
      }
      ctx.lineWidth = dash.length ? 2 : 3;
      ctx.strokeStyle = col;
      path();
      ctx.stroke();
      ctx.setLineDash([]);
    };
    curve((x) => x, pal.muted, [6, 6]);
    curve((x) => x + rho * Math.max(1 - x, 0) ** 2, pal.red);
    curve((x) => x - Math.log(x - 1) / t, pal.blue, [], 1.0005, 3);

    const dot = (x: number, y: number, col: string) => {
      const [px, py] = toPx(v, x, y);
      ctx.fillStyle = col;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    dot(xp, xp + rho * Math.max(1 - xp, 0) ** 2, pal.red);
    dot(xb, xb - Math.log(xb - 1) / t, pal.blue);
  }, [rho, t, xp, xb, w, h, theme]);

  return (
    <SimFrame
      title="Penalty vs barrier on min x subject to x ≥ 1"
      hint="Red: quadratic penalty x + ρ·max(1 − x, 0)² - its minimizer sits outside and creeps in as ρ grows. Blue: log barrier x − (1/t)·log(x − 1) - its minimizer stays strictly inside and approaches as t grows. Neither reaches x = 1 at finite ρ or t."
      controls={
        <>
          <Slider
            label="penalty ρ"
            value={rho}
            min={0.25}
            max={200}
            log
            onChange={setRho}
            format={(x) => fmt(x, 2)}
          />
          <Slider
            label="barrier t"
            value={t}
            min={0.5}
            max={200}
            log
            onChange={setT}
            format={(x) => fmt(x, 2)}
          />
          <Slider
            label="AL ρ (below)"
            value={alRho}
            min={0.1}
            max={20}
            log
            onChange={setAlRho}
            format={(x) => fmt(x, 2)}
          />
        </>
      }
      readout={
        <div className="nb-sim-table">
          <p className="nb-sim-stat">
            Penalty minimizer x = 1 − 1/(2ρ) = <b>{fmt(xp, 4)}</b> (violation{' '}
            {fmt(1 - xp, 4)}) · Barrier minimizer x = 1 + 1/t ={' '}
            <b>{fmt(xb, 4)}</b> (gap f − p* = 1/t = {fmt(1 / t, 4)})
          </p>
          <p className="nb-sim-stat">
            Augmented Lagrangian on min x² s.t. x = 1 with ρ = {fmt(alRho, 2)}:
            the multiplier learns the constraint force (ν* = −2) and x reaches 1
            without ρ → ∞.
          </p>
          <table>
            <thead>
              <tr>
                <th>k</th>
                {al.map((r) => (
                  <th key={r.k}>{r.k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ν</td>
                {al.map((r) => (
                  <td key={r.k}>{fmt(r.nu, 3)}</td>
                ))}
              </tr>
              <tr>
                <td>x</td>
                {al.map((r) => (
                  <td key={r.k}>{fmt(r.x, 4)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas
          ref={cv}
          style={{ width: w, height: h }}
          role="img"
          aria-label="Penalty and barrier subproblem objectives"
        />
      </div>
    </SimFrame>
  );
}
