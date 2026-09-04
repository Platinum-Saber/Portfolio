'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nav, site } from '@/lib/site';
import { ThemeToggle } from './ThemeToggle';

export function Nav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)',
      }}
    >
      <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link
          href="/"
          className="shrink-0 font-mono text-[13px] font-semibold tracking-tight whitespace-nowrap sm:text-sm"
        >
          {site.name}
        </Link>

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
            return (
              <Link
                key={item.href}
                href={item.href}
                /*
                  Prefetch is off for the heavy route. Next prefetches links in
                  the viewport, and this nav is above the fold on every page —
                  so a prefetched /explore would put its 16 KB route chunk on
                  every single page load, for every visitor, which is exactly
                  what removing the hero link fixed in 8.6.
                */
                prefetch={'heavy' in item && item.heavy ? false : undefined}
                aria-current={active ? 'page' : undefined}
                className="shrink-0 rounded-md px-1.5 py-1.5 text-[13px] whitespace-nowrap transition-colors sm:px-3 sm:text-sm"
                style={{
                  color: active ? 'var(--fg)' : 'var(--fg-muted)',
                  backgroundColor: active ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
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
