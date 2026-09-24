'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type ComponentProps } from 'react';
import { canViewTransition, runViewTransition } from '@/lib/view-transition';
import { canGleam, isGleaming, playGleam } from '@/lib/gleam';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/**
 * `next/link` plus a view transition (Phase 8.3). Everything Next already
 * filters - modifier keys, middle click, `target`, external URLs - happens
 * before `onNavigate` is called, so only a plain same-tab navigation is ever
 * intercepted. No support, reduced motion, or a same-page link: behaves
 * exactly like `<Link>`.
 *
 * Only for content routes. A link to /explore or /lab must stay a plain
 * `<Link>`: the page is frozen while the next route loads, and those routes
 * load megabytes.
 *
 * Inside a `.glass-press` pane the click first plays the pane's gleam
 * (lib/gleam.ts, Phase 9.0c) and navigates when it has swept across.
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
        const a = ref.current;
        if (isGleaming()) {
          // Mid-sweep already: the first click's navigation is on its way.
          e.preventDefault();
          return;
        }

        // 9.0c: a pressable glass pane gleams first, then navigates.
        const pane = a?.closest<HTMLElement>('.glass-press') ?? null;
        const samePage =
          new URL(href, window.location.href).pathname ===
          window.location.pathname;
        const gleam = pane !== null && !samePage && canGleam();
        const transition = canViewTransition(href);
        if (!gleam && !transition) return;
        e.preventDefault();

        const morph = a?.matches('[data-vt-morph]')
          ? a
          : (a?.querySelector<HTMLElement>('[data-vt-morph]') ?? null);
        const opts = { scroll: scroll !== false };
        const navigate = () =>
          replace ? router.replace(href, opts) : router.push(href, opts);
        const go = () =>
          transition ? runViewTransition(navigate, morph) : navigate();

        if (gleam) void playGleam(pane).then(go);
        else go();
      }}
      {...rest}
    />
  );
}
