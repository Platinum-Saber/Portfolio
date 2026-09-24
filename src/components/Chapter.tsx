import type { CSSProperties, ReactNode } from 'react';
import { Mascot, pushVector } from './Mascot';

/**
 * The guided home sequence - Phase 8.9.
 *
 * ONE pinned stage, with every chapter stacked on top of it, each fading in
 * and out over its own slice of the stage's scroll timeline. The first attempt
 * gave each chapter its own sticky runway, and that cannot produce a crossfade:
 * consecutive runways are separated by a viewport's worth of ordinary
 * scrolling, so a chapter physically slides off the top while the next slides
 * up from the bottom. Measured, it was a normal scroll with fades at the ends.
 * Here the chapters never move relative to the viewport - only their opacity
 * changes - and their ranges deliberately overlap, so one is always readable.
 *
 * All of it is CSS scroll-driven animation over `position: sticky`. Native
 * scroll is never intercepted and it costs no JavaScript.
 *
 * The rule that makes this safe on a portfolio rather than on a brand site
 * with forty words: **nothing ever leaves the DOM.** A chapter that has faded
 * out is still there - findable with Ctrl+F, read by a screen reader, scraped
 * by an ATS. Only `opacity` and `transform` change.
 *
 * And it is an enhancement. Below 900px, without `animation-timeline`, or
 * under `prefers-reduced-motion`, none of the staging applies and the page is
 * an ordinary vertical stack - which is what a recruiter on a phone wants.
 */

/** Vertical scroll runway per chapter, in vh. Mirrored in `globals.css`. */
const RUNWAY_VH = 110;

/**
 * The pinned part of the stage's `cover` timeline, in %. The stage is
 * `count * RUNWAY_VH` tall and its `cover` timeline also spans one viewport on
 * each side, so this slice is the only part of the scroll where the stage
 * fills the screen. Shared by the chapters and the mascot, which must agree
 * on it to the decimal - the push only lands if they do.
 */
function pinRange(count: number): [number, number] {
  const pinStart = (100 * 100) / (count * RUNWAY_VH + 100);
  return [pinStart, 100 - pinStart];
}

export function Stage({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const push = pushVector();
  return (
    <div
      className="stage"
      style={
        {
          ['--chapters' as string]: count,
          // Where an outgoing chapter goes: shoved along the mascot's line
          // of travel at the moment it crosses the card.
          ['--push-x' as string]: push.x,
          ['--push-y' as string]: push.y,
          ['--push-r' as string]: push.r,
        } as CSSProperties
      }
    >
      <div className="stage-inner">
        <Mascot range={pinRange(count)} />
        {children}
      </div>
    </div>
  );
}

export function Chapter({
  index,
  count,
  label,
  children,
}: {
  index: number;
  count: number;
  /** Mono uppercase index line. Decorative in the sequence, useful in the stack. */
  label?: string;
  children: ReactNode;
}) {
  const [pinStart, pinEnd] = pinRange(count);
  const slot = (pinEnd - pinStart) / count;

  // The slots ABUT rather than overlap. An overlapping crossfade was tried
  // first and looked wrong for this content: two chapters of text at 0.8
  // opacity on the same surface is not a dissolve, it is a collision - the
  // paragraphs interleave and neither is readable. Sequential handoff instead:
  // the outgoing chapter clears, then the incoming one arrives. The fade bands
  // are ~130px of scroll each, so it reads as a beat, not as a gap.
  const from = pinStart + slot * index;
  const to = pinStart + slot * (index + 1);

  return (
    <section
      className="chapter"
      style={
        {
          ['--ch-from' as string]: `cover ${from.toFixed(2)}%`,
          ['--ch-to' as string]: `cover ${to.toFixed(2)}%`,
        } as CSSProperties
      }
    >
      <div className="chapter-body mx-auto w-full max-w-3xl px-4 sm:px-5">
        {label && (
          <p
            className="mb-5 font-mono text-[11px] tracking-widest uppercase"
            style={{ color: 'var(--fg-muted)' }}
          >
            {label}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
