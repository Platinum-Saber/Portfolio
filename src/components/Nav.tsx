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
          className="shrink-0 font-mono text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          {site.name}
        </Link>

        <div className="flex items-center gap-1">
          {nav.slice(1).map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="rounded-md px-2 py-1.5 text-sm transition-colors sm:px-3"
                style={{
                  color: active ? 'var(--fg)' : 'var(--fg-muted)',
                  backgroundColor: active ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-1">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
