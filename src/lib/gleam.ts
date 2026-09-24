/**
 * Phase 9.0c - the click gleam: a diagonal band of light sweeping across a
 * pressable glass pane (`.glass-press`) before the navigation it triggers.
 *
 * It has to finish BEFORE the route changes, not during it: a view transition
 * captures the old page as a still image the moment it starts, so a gleam
 * still running would freeze mid-sweep inside the snapshot. The cost is a
 * short, deliberate beat between click and navigation - GLEAM_MS, kept under
 * the ~400 ms at which a click starts to feel ignored.
 *
 * Skipped entirely (no delay either) under reduced motion.
 */

export const GLEAM_MS = 340;

let running: HTMLElement | null = null;

export function canGleam(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** True while a pane is mid-gleam - a second click then does nothing. */
export function isGleaming(): boolean {
  return running !== null;
}

export function playGleam(pane: HTMLElement): Promise<void> {
  running = pane;
  return new Promise((resolve) => {
    // Restart cleanly if the attribute is somehow still set.
    pane.removeAttribute('data-gleam');
    void pane.offsetWidth;
    pane.setAttribute('data-gleam', '');

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      pane.removeEventListener('animationend', onEnd);
      pane.removeAttribute('data-gleam');
      running = null;
      resolve();
    };
    // `animationend` for a pseudo-element fires on its element; filter to
    // ours so the card's own `.rise` or anything else cannot end it early.
    const onEnd = (event: AnimationEvent) => {
      if (event.animationName === 'glass-gleam') done();
    };
    pane.addEventListener('animationend', onEnd);
    // Floor under the event: a pane scrolled off-screen or a browser that
    // skips the animation must not strand the visitor on the old page.
    window.setTimeout(done, GLEAM_MS + 80);
  });
}
