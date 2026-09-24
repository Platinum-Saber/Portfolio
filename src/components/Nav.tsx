'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nav, site } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';
import { TransitionLink } from './TransitionLink';

export function Nav() {
  const pathname = usePathname();

  return (
    <header
      // 9.0: the one content-route surface that earns real blur — the page
      // scrolls underneath it, so the frost has something to frost.
      className="glass-blur sticky top-0 z-50 border-b"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 72%, transparent)',
        // Phase 8.3: its own transition group, so the bar holds still while
        // the page beneath it cross-fades.
        viewTransitionName: 'site-nav',
      }}
    >
      <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-5">
        <TransitionLink
          href="/"
          className="shrink-0 font-mono text-[13px] font-semibold tracking-tight whitespace-nowrap sm:text-sm"
        >
          {site.name}
        </TransitionLink>

        {/*
          Five destinations do not fit a 390px header at desktop sizing —
          measured at 449px of content in a 390px bar. The row is tightened on
          small screens and, below that, scrolls horizontally rather than
          spilling: every destination stays reachable at any width.
        */}
        <div className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
          {nav.slice(1).map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            // Heavy routes keep a plain <Link>: a view transition freezes
            // the page until the next route lands (see TransitionLink).
            const heavy = 'heavy' in item && item.heavy;
            const L = heavy ? Link : TransitionLink;
            return (
              <L
                key={item.href}
                href={item.href}
                /*
                  Prefetch is off for the heavy route. Next prefetches links in
                  the viewport, and this nav is above the fold on every page —
                  so a prefetched /explore would put its 16 KB route chunk on
                  every single page load, for every visitor, which is exactly
                  what removing the hero link fixed in 8.6.
                */
                prefetch={heavy ? false : undefined}
                aria-current={active ? 'page' : undefined}
                // 9.0d: the current page sits in a glass capsule; the others
                // are plain text until you are on them — one pane, not five.
                className={`${active ? 'glass glass-btn' : 'rounded-full'} shrink-0 px-1.5 py-1.5 text-[13px] whitespace-nowrap transition-colors sm:px-3 sm:text-sm`}
                style={{ color: active ? 'var(--fg)' : 'var(--fg-muted)' }}
              >
                {item.label}
              </L>
            );
          })}
          <div className="ml-1 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
