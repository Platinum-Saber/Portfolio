'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether this browser can run a canvas at all.
 *
 * Shared by both scenes, and read through `useSyncExternalStore` rather than an
 * effect so the server and the first client render agree on `checking` and
 * hydration does not warn. The result is cached module-wide: probing for a
 * context allocates one, and doing that twice on a page with two entry points
 * is wasteful.
 */
export type Support = 'checking' | 'ok' | 'unsupported';

let cached: Support | null = null;

function read(): Support {
  if (cached) return cached;
  try {
    const canvas = document.createElement('canvas');
    cached =
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        ? 'ok'
        : 'unsupported';
  } catch {
    cached = 'unsupported';
  }
  return cached;
}

const NEVER_CHANGES = () => () => {};
const SERVER_SNAPSHOT = (): Support => 'checking';

export const useWebGLSupport = () =>
  useSyncExternalStore(NEVER_CHANGES, read, SERVER_SNAPSHOT);
