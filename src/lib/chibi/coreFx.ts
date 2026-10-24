/**
 * Raphael's thinking core, ported from the Chibi-Agent overlay
 * (`overlay/chibi_overlay/core_fx.py`, drawn there with QPainter above her
 * head while she thinks or speaks).
 *
 * The geometry, layer order, colours and constants are the overlay's, so the
 * page shows the same object she shows on the desktop:
 * glow -> low-poly cage -> two tilted rings -> geodesic sphere -> shards ->
 * white-hot centre, with `f = 3.2 / (3.2 + z)` perspective.
 *
 * - Thinking: it spins at a fixed rate and the shards spiral into the centre.
 * - Speaking: spin, size and brightness follow the voice level, and the shards
 *   settle into a wavy orbit.
 *
 * One deliberate difference: the shards are seeded with mulberry32 rather than
 * Python's Mersenne Twister, so their starting positions differ from the
 * overlay's. Nobody can tell; matching MT19937 would cost 2 KB for nothing.
 *
 * Pure maths and a Canvas2D painter, no React, so it can run in any canvas.
 */

type Vec3 = readonly [number, number, number];
type RGB = readonly [number, number, number];

export const CYAN: RGB = [127, 227, 255];
export const VIOLET: RGB = [165, 123, 255];
export const GREEN: RGB = [120, 230, 170];
export const WHITE: RGB = [245, 250, 255];
const CAGE_EDGE: RGB = [220, 240, 200];

/** The overlay's cage radius at rest; line widths scale against it. */
export const SIZE = 70;
const FADE_S = 0.35;
const SHARDS = 26;

function icosahedron(): { verts: Vec3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const v: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
    [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
    [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { verts: v.map(norm), faces };
}

function norm([x, y, z]: Vec3): Vec3 {
  const r = Math.hypot(x, y, z);
  return [x / r, y / r, z / r];
}

/** An icosahedron subdivided once: 42 points on the sphere, and its edges. */
function geodesic(): { verts: Vec3[]; edges: [number, number][] } {
  const { verts: base, faces } = icosahedron();
  const verts = [...base];
  const mid = new Map<string, number>();
  const m = (a: number, b: number) => {
    const k = `${Math.min(a, b)}:${Math.max(a, b)}`;
    let i = mid.get(k);
    if (i === undefined) {
      const [ax, ay, az] = verts[a];
      const [bx, by, bz] = verts[b];
      verts.push(norm([(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2]));
      i = verts.length - 1;
      mid.set(k, i);
    }
    return i;
  };
  const edges = new Set<string>();
  for (const [a, b, c] of faces) {
    const ab = m(a, b), bc = m(b, c), ca = m(c, a);
    for (const tri of [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]) {
      for (let i = 0; i < 3; i++) {
        const p = tri[i], q = tri[(i + 1) % 3];
        edges.add(`${Math.min(p, q)}:${Math.max(p, q)}`);
      }
    }
  }
  return { verts, edges: [...edges].map((e) => e.split(':').map(Number) as [number, number]).sort((x, y) => x[0] - y[0] || x[1] - y[1]) };
}

const SPHERE = geodesic();
const CAGE_V = icosahedron().verts;
const CAGE_E: [number, number][] = (() => {
  const s = new Set<string>();
  for (const [a, b, c] of icosahedron().faces) {
    for (const [p, q] of [[a, b], [b, c], [c, a]]) s.add(`${Math.min(p, q)}:${Math.max(p, q)}`);
  }
  return [...s].map((e) => e.split(':').map(Number) as [number, number]);
})();

function rot([x0, y0, z0]: Vec3, ay: number, ax: number, az = 0): Vec3 {
  const x = x0 * Math.cos(ay) + z0 * Math.sin(ay);
  const z1 = -x0 * Math.sin(ay) + z0 * Math.cos(ay);
  const y = y0 * Math.cos(ax) - z1 * Math.sin(ax);
  const z = y0 * Math.sin(ax) + z1 * Math.cos(ax);
  return [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az), z];
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgba = ([r, g, b]: RGB, a255: number) =>
  `rgba(${r},${g},${b},${Math.max(0, Math.min(255, a255)) / 255})`;

export type CoreInput = {
  thinking: boolean;
  speaking: boolean;
  /** 0..1, the voice level (the overlay feeds lip RMS x 1.6). */
  level: number;
};

export class CoreFX {
  alpha = 0;
  level = 0;
  spin = 0;
  thinking = false;
  /** [angle, radius (x cage), height, size, speed] */
  readonly shards: number[][];

  constructor(seed = 7) {
    const rnd = mulberry32(seed);
    const u = (a: number, b: number) => a + (b - a) * rnd();
    this.shards = Array.from({ length: SHARDS }, () => [
      u(0, 2 * Math.PI), u(0.3, 1.6), u(-0.5, 0.5), u(0.05, 0.12), u(0.6, 1.4),
    ]);
  }

  /** Advance by `dt` seconds; same rules as the overlay's `CoreFX.update`. */
  update(dt: number, { thinking, speaking, level }: CoreInput): void {
    this.thinking = thinking && !speaking;
    const want = thinking || speaking ? 1 : 0;
    this.alpha += (want - this.alpha) * (1 - Math.exp(-dt / FADE_S));
    const k = level > this.level ? 0.5 : 0.15; // quick attack, slow release
    this.level += ((speaking ? level : 0) - this.level) * k;
    this.spin += dt * (this.thinking ? 0.9 : 0.55 + 0.6 * this.level);
    for (const s of this.shards) {
      s[0] += dt * s[4] * (this.thinking ? 1.6 : 0.7);
      if (this.thinking) {
        s[1] -= dt * 0.35 * s[4];
        if (s[1] < 0.15) s[1] = 1.6;
      } else {
        s[1] += (1.15 + 0.3 * Math.sin(s[0] * 3) - s[1]) * Math.min(1, dt * 1.5);
      }
    }
  }

  /** Jump straight to a settled state (reduced motion, first frame). */
  settle(input: CoreInput): void {
    for (let i = 0; i < 60; i++) this.update(1 / 30, input);
  }

  /**
   * Paint centred at (cx, cy) in canvas pixels. `radius` replaces the overlay's
   * `SIZE_DIP * scale`; the whole object reaches about 1.6 x radius (the glow).
   */
  paint(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    if (this.alpha <= 0.01) return;
    const a = this.alpha;
    const lv = this.level;
    const scale = radius / SIZE;
    const r = radius * (1 + 0.35 * lv); // expands with the voice
    const bright = this.thinking ? 0.75 : 0.55 + 0.45 * lv;
    const t = this.spin;
    const proj = (v: Vec3, rr: number, ay: number, ax: number, az = 0): [number, number, number] => {
      const [x, y, z] = rot(v, ay, ax, az);
      const f = 3.2 / (3.2 + z);
      return [x * rr * f, y * rr * f, z];
    };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';

    // glow behind everything
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
    g.addColorStop(0, rgba([255, 255, 255], 230 * a * bright));
    g.addColorStop(0.18, rgba(CYAN, 150 * a * bright));
    g.addColorStop(0.45, rgba(GREEN, 60 * a * bright));
    g.addColorStop(0.75, rgba(VIOLET, 35 * a * bright));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, 2 * Math.PI);
    ctx.fill();

    // outer cage: low-poly, counter-rotating
    let pts = CAGE_V.map((v) => proj(v, r * 1.25, -t * 0.6, 0.5 + t * 0.2, 0.2));
    ctx.lineWidth = 1 * scale;
    for (const [i, j] of CAGE_E) {
      const pa = pts[i], pb = pts[j];
      const depth = (2 - (pa[2] + pb[2]) / 2) / 3;
      ctx.strokeStyle = rgba(CAGE_EDGE, 140 * a * depth * bright);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }
    for (const [x, y, z] of pts) {
      ctx.fillStyle = rgba(WHITE, ((200 * a * (1 - z)) / 2) * bright + 40 * a);
      ctx.beginPath();
      ctx.arc(x, y, 2.2 * scale, 0, 2 * Math.PI);
      ctx.fill();
    }

    // rings
    ([[0.9, WHITE], [-1.2, CYAN]] as const).forEach(([tilt, col], k) => {
      ctx.strokeStyle = rgba(col, 170 * a * bright);
      ctx.lineWidth = (2.2 - k * 0.8) * scale;
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const u = (2 * Math.PI * i) / 32;
        const [x, y] = proj([Math.cos(u), 0, Math.sin(u)], r * (0.95 + 0.12 * k), t * (0.8 - 0.3 * k), tilt);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    });

    // geodesic sphere
    pts = SPHERE.verts.map((v) => proj(v, r * 0.72, t, 0.35 + t * 0.4));
    ctx.lineWidth = 0.9 * scale;
    for (const [i, j] of SPHERE.edges) {
      const pa = pts[i], pb = pts[j];
      const depth = (2 - (pa[2] + pb[2]) / 2) / 3;
      ctx.strokeStyle = rgba((i + j) % 3 ? CYAN : VIOLET, 190 * a * depth * bright);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(WHITE, 230 * a * bright);
    for (const [x, y, z] of pts) {
      if (z >= 0.2) continue;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * scale, 0, 2 * Math.PI);
      ctx.fill();
    }

    // shards
    for (const [ang, rad, hgt, size] of this.shards) {
      const [x, y, z] = proj([Math.cos(ang) * rad, hgt, Math.sin(ang) * rad], r, t * 0.3, 0.4);
      const s = size * r * (3.2 / (3.2 + z));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang * 1.5);
      ctx.fillStyle = rgba(z < 0 ? WHITE : CYAN, 200 * a * (0.5 + 0.5 * bright) * Math.max(0.15, (1.2 - z) / 2.2));
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // white-hot centre
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.38);
    g.addColorStop(0, rgba([255, 255, 255], 255 * a));
    g.addColorStop(0.5, rgba([255, 255, 255], 160 * a * bright));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
}
