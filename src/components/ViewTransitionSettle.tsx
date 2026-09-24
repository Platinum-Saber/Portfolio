'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { settleViewTransition } from '@/lib/view-transition';

/**
 * The "navigation has finished" signal for Phase 8.3. Lives in the root
 * layout, so it survives every navigation; its layout effect runs in the
 * same commit as the new route (and Next's scroll-to-top), and the promise
 * it resolves is read after that commit - so the browser captures the new
 * frame already scrolled.
 */
export function ViewTransitionSettle() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    settleViewTransition();
  }, [pathname]);
  return null;
}
