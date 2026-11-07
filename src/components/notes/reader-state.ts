'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Settings shared by the guide reader and the mock-paper runner: anything kept
 * in localStorage, the site's light/dark theme and media queries.
 */
/* ---------------------------------------------------- persisted settings
 * useSyncExternalStore, the pattern the site already uses (AudioToggle,
 * AirframeExplorer): no hydration mismatch, no setState-in-effect cascade.
 * Snapshots are the raw strings, so they are stable between renders. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}
export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the setting just won't persist.
  }
  listeners.forEach((l) => l());
}
export function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback is a constant per call site
  }, [raw]);
  const set = useCallback((v: T) => write(key, v), [key]);
  return [value, set];
}

/** The site's own light/dark choice, for the reader's "auto" theme. */
export function useSiteTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      return () => mo.disconnect();
    },
    () =>
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light',
    () => 'light',
  );
}

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
