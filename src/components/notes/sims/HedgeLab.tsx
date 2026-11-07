'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, palette, setupCanvas } from './canvas';
import { Select, SimFrame, Slider, useCanvasSize } from './SimFrame';

/**
 * Membership-function features (core, support, crossover, height), λ-cuts, and
 * Zadeh's linguistic hedges applied to the "Age" variable of Example 6.1.
 */

type Base = 'young' | 'old' | 'middle' | 'adult';
type Hedge = 'none' | 'very' | 'veryvery' | 'plus' | 'moreless' | 'minus' | 'int' | 'not' | 'notvery';

const BASE: Record<Base, { label: string; f: (y: number) => number }> = {
  young: { label: 'young  (eq. 6.2)', f: (y) => (y <= 25 ? 1 : 1 / (1 + ((y - 25) / 5) ** 2)) },
  old: { label: 'old  (eq. 6.3)', f: (y) => (y < 50 ? 0 : 1 - 1 / (1 + ((y - 50) / 5) ** 2)) },
  middle: { label: 'middle-aged  (triangle 30/45/60)', f: (y) => Math.max(0, Math.min((y - 30) / 15, (60 - y) / 15)) },
  adult: { label: 'adult  (trapezoid 15/20/60/80)', f: (y) => Math.max(0, Math.min((y - 15) / 5, 1, (80 - y) / 20)) },
};
const HEDGE: Record<Hedge, { label: string; g: (m: number) => number }> = {
  none: { label: '(no hedge)', g: (m) => m },
  very: { label: 'very  μ²', g: (m) => m ** 2 },
  veryvery: { label: 'very very  μ⁴', g: (m) => m ** 4 },
  plus: { label: 'plus  μ^1.25', g: (m) => m ** 1.25 },
  moreless: { label: 'more or less  μ^0.5', g: (m) => Math.sqrt(m) },
  minus: { label: 'minus  μ^0.75', g: (m) => m ** 0.75 },
  int: { label: 'intensify  INT(μ)', g: (m) => (m <= 0.5 ? 2 * m * m : 1 - 2 * (1 - m) ** 2) },
  not: { label: 'not  1 − μ', g: (m) => 1 - m },
  notvery: { label: 'not very  1 − μ²', g: (m) => 1 - m * m },
};

export function HedgeLab() {
  const [base, setBase] = useState<Base>('young');
  const [hedge, setHedge] = useState<Hedge>('very');
  const [lam, setLam] = useState(0.5);
  const { wrap, w, h, theme } = useCanvasSize(0.42, 280);
  const cv = useRef<HTMLCanvasElement>(null);
  const B = BASE[base].f, H = HEDGE[hedge].g;

  // features of the hedged set, sampled on [0, 100]
  const feat = useMemo(() => {
    const ys = Array.from({ length: 10001 }, (_, i) => i / 100);
    const ms = ys.map((y) => H(B(y)));
    const range = (pred: (m: number) => boolean) => {
      const sel = ys.filter((_, i) => pred(ms[i]));
      return sel.length ? [sel[0], sel[sel.length - 1]] as const : null;
    };
    const cross = ys.filter((_, i) => i > 0 && (ms[i - 1] - 0.5) * (ms[i] - 0.5) <= 0 && ms[i - 1] !== ms[i]);
    return {
      height: Math.max(...ms),
      core: range((m) => m >= 1 - 1e-9),
      support: range((m) => m > 1e-6),
      cut: range((m) => m >= lam),
      cross,
    };
  }, [B, H, lam]);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = setupCanvas(c, w, h);
    const pal = palette(c);
    ctx.fillStyle = pal.card; ctx.fillRect(0, 0, w, h);
    const L = 34, R = 10, T = 12, Bm = 28;
    const X = (y: number) => L + (y / 100) * (w - L - R);
    const Y = (m: number) => T + (1 - m) * (h - T - Bm);
    ctx.font = '11px ui-monospace, monospace'; ctx.fillStyle = pal.muted; ctx.strokeStyle = pal.ink;
    for (let a = 0; a <= 100; a += 10) { ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.moveTo(X(a), T); ctx.lineTo(X(a), Y(0)); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(String(a), X(a) - 6, h - 10); }
    for (const m of [0, 0.5, 1]) { ctx.fillText(String(m), 4, Y(m) + 4); }
    ctx.lineWidth = 1.5; ctx.strokeRect(L, T, w - L - R, h - T - Bm);
    const plot = (f: (y: number) => number, col: string, lw: number, dash: number[] = []) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash); ctx.beginPath();
      for (let i = 0; i <= 500; i++) { const y = i / 5; if (i) ctx.lineTo(X(y), Y(f(y))); else ctx.moveTo(X(y), Y(f(y))); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    plot(B, pal.muted, 2, [6, 4]);
    const mu = (y: number) => H(B(y));
    plot(mu, pal.ink, 5); plot(mu, pal.blue, 3);
    // λ-cut
    ctx.strokeStyle = pal.red; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(L, Y(lam)); ctx.lineTo(w - R, Y(lam)); ctx.stroke(); ctx.setLineDash([]);
    if (feat.cut) {
      ctx.strokeStyle = pal.red; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(X(feat.cut[0]), Y(0) - 3); ctx.lineTo(X(feat.cut[1]), Y(0) - 3); ctx.stroke();
    }
    ctx.fillStyle = pal.yellow; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2;
    for (const cx of feat.cross) { ctx.beginPath(); ctx.arc(X(cx), Y(0.5), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }, [B, H, lam, feat, w, h, theme]);

  const iv = (r: readonly [number, number] | null) => (r ? `[${fmt(r[0], 1)}, ${fmt(r[1], 1)}]` : '∅');
  return (
    <SimFrame
      title="Membership features, λ-cuts and linguistic hedges"
      hint="Dashed grey: the primary term. Blue: after the hedge. 'very' (concentration, μ²) shrinks partial memberships - 0.9 → 0.81 but 0.1 → 0.01 - so the set gets narrower; 'more or less' (dilation, √μ) widens it; INT steepens the curve around the crossover μ = 0.5. Hedges never move the core (μ = 1) or the support (μ > 0), only the boundary. The red bar is the λ-cut: the crisp set {x : μ(x) ≥ λ}."
      controls={
        <>
          <Select label="primary term (age)" value={base} onChange={setBase} options={(Object.keys(BASE) as Base[]).map((k) => ({ value: k, label: BASE[k].label }))} />
          <Select label="hedge" value={hedge} onChange={setHedge} options={(Object.keys(HEDGE) as Hedge[]).map((k) => ({ value: k, label: HEDGE[k].label }))} />
          <Slider label="λ (alpha-cut level)" value={lam} min={0.05} max={1} step={0.05} onChange={setLam} />
        </>
      }
      readout={
        <p className="nb-sim-stat">
          height <b>{fmt(feat.height, 3)}</b> ({feat.height >= 1 - 1e-9 ? 'normal' : 'subnormal'}) · core {iv(feat.core)} · support {iv(feat.support)} ·
          crossover {feat.cross.length ? feat.cross.map((c) => fmt(c, 1)).join(', ') : 'none'} · λ-cut at {fmt(lam, 2)}: <b>{iv(feat.cut)}</b>
        </p>
      }
    >
      <div ref={wrap} className="nb-canvas-wrap">
        <canvas ref={cv} style={{ width: w, height: h }} role="img" aria-label="Membership function with hedge and alpha-cut" />
      </div>
    </SimFrame>
  );
}
