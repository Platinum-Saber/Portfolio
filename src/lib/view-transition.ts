/**
 * Phase 8.3 — hand-rolled same-document view transitions for the App Router.
 *
 * React 19.2 stable has no `<ViewTransition>`, and CSS `@view-transition`
 * only fires on cross-document navigation, which the App Router never does.
 * So the navigation is wrapped in `document.startViewTransition` by hand:
 *
 *   click → old frame captured → router.push() → new route commits →
 *   <ViewTransitionSettle> sees the pathname change → promise resolves →
 *   new frame captured → the browser animates between the two.
 *
 * The fragile part is knowing when an App Router navigation has finished.
 * The pathname changing inside a layout effect is that signal; MAX_WAIT is
 * the floor under it, so a slow or failed navigation can freeze the page for
 * at most that long before the transition gives up and the route lands
 * without animation.
 *
 * Shared element: no element carries a `view-transition-name` statically.
 * A static name on every card title would make hidden cards (faded home
 * chapters, cards scrolled off-screen) fly across the page on any navigation
 * to /projects. Instead the name is set on the ONE clicked element
 * (`[data-vt-morph]`) and on the landing element (`[data-vt-land]`) only
 * for the duration of the transition.
 */

const MAX_WAIT = 2000;
const MORPH = 'vt-morph';

let pending: (() => void) | null = null;

/** Called by <ViewTransitionSettle> once the new route has committed. */
export function settleViewTransition() {
  pending?.();
}

export function canViewTransition(href: string): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof document.startViewTransition !== 'function') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return false;
  // Same pathname (a hash or query change) never changes the pathname, so
  // the settle signal would never come. Let those navigate plainly.
  const target = new URL(href, window.location.href);
  return target.pathname !== window.location.pathname;
}

export function runViewTransition(
  navigate: () => void,
  morph: HTMLElement | null,
) {
  // A second click mid-transition: release the first one now.
  settleViewTransition();

  if (morph) morph.style.viewTransitionName = MORPH;
  let landed: HTMLElement | null = null;

  const vt = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(done, MAX_WAIT);
        function done() {
          window.clearTimeout(timer);
          if (pending === done) pending = null;
          if (morph) {
            morph.style.viewTransitionName = '';
            landed = document.querySelector<HTMLElement>('[data-vt-land]');
            if (landed) landed.style.viewTransitionName = MORPH;
          }
          resolve();
        }
        pending = done;
        navigate();
      }),
  );

  const cleanup = () => {
    if (morph) morph.style.viewTransitionName = '';
    if (landed) landed.style.viewTransitionName = '';
  };
  // A skipped transition rejects `ready`; the navigation still happened.
  vt.ready.catch(() => {});
  vt.finished.then(cleanup, cleanup);
}
