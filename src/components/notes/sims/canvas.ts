/**
 * Shared drawing helpers for the notes simulations. Canvas 2D, no
 * dependencies. Colours are read from the neo-brutalist CSS variables on the
 * canvas element, so every sim follows the light/dark theme.
 *
 * Holds algorithm and plotting code only - never guide text.
 */

export type Palette = {
  ink: string;
  card: string;
  paper: string;
  muted: string;
  mint: string;
  yellow: string;
  pink: string;
  blue: string;
  orange: string;
  red: string;
};

export function palette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    ink: v('--nb-ink', '#111'),
    card: v('--nb-card', '#fff'),
    paper: v('--nb-paper', '#fffdf6'),
    muted: v('--nb-muted', '#555'),
    mint: v('--nb-mint', '#7cf5c8'),
    yellow: v('--nb-yellow', '#ffe066'),
    pink: v('--nb-pink', '#ff9ec4'),
    blue: v('--nb-blue', '#9dcbff'),
    orange: v('--nb-orange', '#ffb36b'),
    red: v('--nb-red', '#ff5d5d'),
  };
}

/** Size the backing store for the device pixel ratio; returns a context in CSS pixels. */
export function setupCanvas(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export type View = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  w: number;
  h: number;
};

export const toPx = (v: View, x: number, y: number): [number, number] => [
  ((x - v.x0) / (v.x1 - v.x0)) * v.w,
  v.h - ((y - v.y0) / (v.y1 - v.y0)) * v.h,
];
export const fromPx = (v: View, px: number, py: number): [number, number] => [
  v.x0 + (px / v.w) * (v.x1 - v.x0),
  v.y0 + ((v.h - py) / v.h) * (v.y1 - v.y0),
];

function hexToRgb(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [200, 200, 200];
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((x) => x + x)
      .join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Flat banded contour map: log-spaced bands in two alternating tints with an
 * ink line where the band changes - the neo-brutalist take on a contour plot.
 * Rendered once into an offscreen canvas and blitted.
 */
export function contourImage(
  f: (x: number, y: number) => number,
  v: View,
  pal: Palette,
  opts: { bands?: number; res?: number; linear?: boolean } = {},
): HTMLCanvasElement {
  const res = opts.res ?? 2;
  const W = Math.ceil(v.w / res);
  const H = Math.ceil(v.h / res);
  const vals = new Float64Array(W * H);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const [x, y] = fromPx(v, (i + 0.5) * res, (j + 0.5) * res);
      const z = f(x, y);
      vals[j * W + i] = z;
      if (Number.isFinite(z)) {
        if (z < lo) lo = z;
        if (z > hi) hi = z;
      }
    }
  const bands = opts.bands ?? 14;
  const t = (z: number) =>
    opts.linear
      ? (z - lo) / (hi - lo || 1)
      : Math.log1p(z - lo) / Math.log1p(hi - lo || 1);
  const band = new Int16Array(W * H);
  for (let k = 0; k < vals.length; k++)
    band[k] = Math.min(bands - 1, Math.floor(Math.max(0, t(vals[k])) * bands));

  const a = hexToRgb(pal.paper);
  const b = hexToRgb(pal.blue);
  const ink = hexToRgb(pal.ink);
  const img = new ImageData(W, H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const edge =
        (i + 1 < W && band[k + 1] !== band[k]) ||
        (j + 1 < H && band[k + W] !== band[k]);
      // Fill strength falls with the band: the valley floor is the strongest tint.
      const s = 1 - band[k] / bands;
      const mix = (u: number, w: number) => Math.round(u + (w - u) * s * 0.85);
      const c = edge
        ? ink
        : [mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2])];
      img.data.set([c[0], c[1], c[2], edge ? 150 : 255], k * 4);
    }
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  off.getContext('2d')!.putImageData(img, 0, 0);
  return off;
}

export function drawPath(
  ctx: CanvasRenderingContext2D,
  v: View,
  pts: [number, number][],
  color: string,
  ink: string,
) {
  if (pts.length === 0) return;
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const [px, py] = toPx(v, clampBig(x), clampBig(y));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.lineWidth = 1.2;
  const step = Math.max(1, Math.floor(pts.length / 60));
  for (let i = 0; i < pts.length; i += step) {
    const [px, py] = toPx(v, clampBig(pts[i][0]), clampBig(pts[i][1]));
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }
  const [lx, ly] = pts[pts.length - 1];
  const [px, py] = toPx(v, clampBig(lx), clampBig(ly));
  ctx.beginPath();
  ctx.rect(px - 5, py - 5, 10, 10);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export const clampBig = (x: number) =>
  Number.isFinite(x) ? Math.max(-1e6, Math.min(1e6, x)) : x > 0 ? 1e6 : -1e6;

export function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  ink: string,
) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45));
  ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Seeded PRNG (mulberry32) + Box–Muller, so a run can be replayed exactly. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const a = Math.max(u(), 1e-12);
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
  };
  return { u, normal };
}

export function fmt(x: number, d = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : 'NaN';
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-3 || a >= 1e5))
    return x.toExponential(2).replace('-', '−');
  return (
    x
      .toFixed(d)
      .replace(/\.?0+$/, '')
      .replace('-', '−') || '0'
  );
}

/** Axis frame with ticks for 1-D plots. */
export function axes(
  ctx: CanvasRenderingContext2D,
  v: View,
  pal: Palette,
  xticks: number[],
  yticks: number[],
) {
  ctx.save();
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = pal.muted;
  ctx.strokeStyle = pal.ink;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  for (const t of xticks) {
    const [px] = toPx(v, t, 0);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, v.h);
    ctx.stroke();
  }
  for (const t of yticks) {
    const [, py] = toPx(v, 0, t);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(v.w, py);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const t of xticks) {
    const [px] = toPx(v, t, 0);
    ctx.fillText(fmt(t, 2), px + 3, v.h - 4);
  }
  for (const t of yticks) {
    const [, py] = toPx(v, 0, t);
    ctx.fillText(fmt(t, 2), 4, py - 3);
  }
  ctx.restore();
}

export function ticks(lo: number, hi: number, n = 6): number[] {
  const span = hi - lo;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? mag * 10;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step)
    out.push(Math.abs(t) < 1e-12 ? 0 : t);
  return out;
}
