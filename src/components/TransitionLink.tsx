'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type ComponentProps } from 'react';
import { canViewTransition, runViewTransition } from '@/lib/view-transition';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/**
 * `next/link` plus a view transition (Phase 8.3). Everything Next already
 * filters — modifier keys, middle click, `target`, external URLs — happens
 * before `onNavigate` is called, so only a plain same-tab navigation is ever
 * intercepted. No support, reduced motion, or a same-page link: behaves
 * exactly like `<Link>`.
 *
 * Only for content routes. A link to /explore or /lab must stay a plain
 * `<Link>`: the page is frozen while the next route loads, and those routes
 * load megabytes.
 *
 * Put `data-vt-morph` on the element that should morph into the destination
 * page's `data-vt-land` element (or on the link itself).
 */
export function TransitionLink({
  href,
  replace,
  scroll,
  onNavigate,
  ...rest
}: Props) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <Link
      ref={ref}
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(e) => {
        onNavigate?.(e);
        if (!canViewTransition(href)) return;
        e.preventDefault();

        const a = ref.current;
        const morph = a?.matches('[data-vt-morph]')
          ? a
          : (a?.querySelector<HTMLElement>('[data-vt-morph]') ?? null);
        const opts = { scroll: scroll !== false };

        runViewTransition(
          () => (replace ? router.replace(href, opts) : router.push(href, opts)),
          morph,
        );
      }}
      {...rest}
    />
  );
}
