'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

/**
 * The slow-navigation indicator - the logo cutting itself on a loop.
 *
 * Why not app/loading.tsx: every content route is static and prefetched, so
 * the App Router either swaps pages instantly or, when the payload has not
 * arrived yet (a cold Worker, a slow network, a dev-mode compile), holds the
 * old page with no feedback at all - a route loading boundary never gets the
 * chance to render. This watches the click instead: an internal link was
 * followed, and the path has not changed yet.
 *
 * The overlay is mounted as soon as a navigation starts but stays invisible
 * for 500 ms (`.ps-loader` in globals.css), so a normal navigation never
 * flashes it. It never takes pointer events, and gives up after 12 s so a
 * failed navigation cannot leave it on screen.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const [nav, setNav] = useState<{ from: string; target: string | null }>({
    from: pathname,
    target: null,
  });

  // Arrived (or went somewhere else): drop the pending target. Adjusting
  // state during render, not in an effect, so the overlay never paints once
  // more after the new page is in.
  if (nav.from !== pathname) {
    setNav({ from: pathname, target: null });
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (a hash link) or a file (the CV PDF): not a route change.
      if (url.pathname === window.location.pathname) return;
      if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
      setNav((current) => ({ ...current, target: url.pathname }));
    }
    document.addEventListener('click', onClick, { capture: true });
    return () =>
      document.removeEventListener('click', onClick, { capture: true });
  }, []);

  useEffect(() => {
    if (!nav.target) return;
    const giveUp = window.setTimeout(
      () => setNav((current) => ({ ...current, target: null })),
      12000,
    );
    return () => window.clearTimeout(giveUp);
  }, [nav.target]);

  if (!nav.target) return null;

  return (
    <div className="ps-loader ps-nav-loader" role="status">
      <Logo size={72} animated />
      <p
        className="font-mono text-xs tracking-widest uppercase"
        style={{ color: 'var(--fg-muted)' }}
      >
        Loading
      </p>
    </div>
  );
}
