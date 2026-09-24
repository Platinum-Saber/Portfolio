import type { CSSProperties } from 'react';

/**
 * The home-page mascot — the VT-802, the craft you fly in /explore.
 *
 * A pre-rendered sprite, not a live scene: `/` may not load three.js (the
 * locked "nothing 3D in the homepage's initial graph" rule, and ~1.4 MB it
 * cannot afford). `public/images/vt-802-sprite.webp` holds the real model
 * rendered at 24 headings, 15° apart, in /explore's lighting rig — 57 KB,
 * fetched only where the stage exists (≥900px, motion allowed), because the
 * background image is declared inside that media query.
 *
 * Three nested layers, each owning one kind of motion, so none has to know
 * about the others:
 *
 *   .mascot-orbit   SCROLL — flies a tilted ellipse, one lap per chapter, on
 *                   the stage's own view timeline. Passes in FRONT of the
 *                   cards on the near half of the lap (larger, z above) and
 *                   BEHIND the glass on the far half (smaller, dimmer).
 *   .mascot-idle    TIME — hovers: a bob and a slow sway, always running, so
 *                   the craft is alive when nobody is scrolling.
 *   .mascot-sprite  SCROLL — picks the heading frame that matches the
 *                   direction of travel at that point of the lap.
 *
 * The push: each lap crosses the card at PUSH_AT of the chapter's slot, which
 * is where the chapter's exit animation already sits (82–100% of its slot, see
 * `chapter-cycle` in globals.css). The chapter's exit translates along the
 * drone's own direction of travel at that point (`pushVector`), so the card
 * leaves the way it was shoved.
 *
 * Everything is computed here, at build time, into a static <style>: the page
 * ships zero JavaScript for this, the same as the rest of the stage.
 */

/** Frames in the sprite strip, and their size as drawn (CSS px). */
const FRAMES = 24;
const SPRITE_W = 100;
const SPRITE_H = 70;

/** Tilt of the ellipse's major axis, degrees. Negative rises to the right. */
const TILT = -20;
/** Semi-axes' ratio used for headings; the drawn size is --orbit-a/--orbit-b. */
const A = 600;
const B = 170; // keep in step with --orbit-b in globals.css
/** Where in each chapter's slot the craft crosses the card. */
export const PUSH_AT = 0.88;
/** Keyframe segments per lap. The path is a 32-gon — invisible at this size. */
const SEGMENTS = 32;

const rad = (d: number) => (d * Math.PI) / 180;
const cosT = Math.cos(rad(TILT));
const sinT = Math.sin(rad(TILT));

/** Lap angle at lap progress t ∈ [0,1]; 90° is the near side (front). */
const theta = (t: number) => 90 + (t - PUSH_AT) * 360;

/** Unit coefficients so position = a·(ka) + b·(kb), in screen space. */
function position(t: number) {
  const th = rad(theta(t));
  const ex = Math.cos(th); // × a
  const ey = Math.sin(th); // × b   (y down: +90° is the near, lower side)
  return {
    xa: ex * cosT,
    xb: -ey * sinT,
    ya: ex * sinT,
    yb: ey * cosT,
    depth: Math.sin(th), // +1 front, −1 back
  };
}

/** Screen-space velocity direction at t (using the A:B ratio). */
function velocity(t: number) {
  const th = rad(theta(t));
  const vx = -A * Math.sin(th);
  const vy = B * Math.cos(th);
  return { x: vx * cosT - vy * sinT, y: vx * sinT + vy * cosT };
}

/** Sprite frame for a screen-space direction. Frame 0 faces the viewer
 *  (moving down the screen); frame 6 faces right; 12 away; 18 left. */
function frameFor(t: number) {
  const v = velocity(t);
  const yaw = (Math.atan2(v.x, v.y) * 180) / Math.PI;
  return ((Math.round(yaw / (360 / FRAMES)) % FRAMES) + FRAMES) % FRAMES;
}

/** Where the pushed card goes: along the craft's travel at the push. */
export function pushVector(distance = 90) {
  const v = velocity(PUSH_AT);
  const len = Math.hypot(v.x, v.y);
  const x = (v.x / len) * distance;
  const y = (v.y / len) * distance;
  return { x: `${x.toFixed(1)}px`, y: `${y.toFixed(1)}px`, r: `${(x > 0 ? 4 : -4)}deg` };
}

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
const px = (n: number) => n.toFixed(4);

function keyframes(): string {
  const orbit: string[] = [];
  const sprite: string[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const t = i / SEGMENTS;
    const p = position(t);
    const scale = 0.9 + 0.2 * p.depth;
    orbit.push(
      `${pct(t)}{transform:translate(calc(var(--orbit-a)*${px(p.xa)} + var(--orbit-b)*${px(p.xb)}),calc(var(--orbit-a)*${px(p.ya)} + var(--orbit-b)*${px(p.yb)})) scale(${scale.toFixed(3)});z-index:${p.depth > 0 ? 3 : 0};opacity:${p.depth > 0 ? 1 : 0.78}}`,
    );
    if (i < SEGMENTS) {
      // Hold each frame for its segment, then jump — a heading is a pose,
      // and interpolating background-position would slide between poses.
      const x = `${-frameFor(t + 0.5 / SEGMENTS) * SPRITE_W}px 0`;
      sprite.push(`${pct(t)}{background-position:${x}}`);
      sprite.push(`${pct((i + 1) / SEGMENTS - 0.00001)}{background-position:${x}}`);
    }
  }
  return `@keyframes mascot-orbit{${orbit.join('')}}@keyframes mascot-heading{${sprite.join('')}}`;
}

/** Built once per server render — the page is static, so once per build. */
const CSS = keyframes();

export function Mascot({ range }: { range: [number, number] }) {
  return (
    <div
      aria-hidden="true"
      className="mascot"
      style={
        {
          ['--mascot-from' as string]: `cover ${range[0].toFixed(2)}%`,
          ['--mascot-to' as string]: `cover ${range[1].toFixed(2)}%`,
          ['--sprite-w' as string]: `${SPRITE_W}px`,
          ['--sprite-h' as string]: `${SPRITE_H}px`,
          ['--sprite-strip' as string]: `${SPRITE_W * FRAMES}px`,
        } as CSSProperties
      }
    >
      <style>{CSS}</style>
      <div className="mascot-orbit">
        <div className="mascot-idle">
          <div className="mascot-sprite" />
        </div>
      </div>
    </div>
  );
}
