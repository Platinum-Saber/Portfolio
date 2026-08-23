'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fills the viewport with one element, for both flight scenes.
 *
 * Shared rather than copied because the interesting parts are all edge cases,
 * and a second hand-written copy would get some of them wrong:
 *
 * ── iPhone has no Fullscreen API ───────────────────────────────────────────
 * Safari on iPhone has never implemented `Element.requestFullscreen` — iPad
 * has. So the one platform where a small canvas hurts most is the one the
 * standard route does not reach, and a fixed-position overlay has to stand in.
 * Detected by looking for the method, never by sniffing the browser.
 *
 * ── The request must ride a user gesture ───────────────────────────────────
 * Browsers refuse `requestFullscreen` outside a user-initiated event, and the
 * refusal arrives as a rejected promise rather than anything visible. Call
 * `enter` synchronously from the click handler; await something first and it
 * silently does nothing.
 *
 * ── The browser can leave without telling you ──────────────────────────────
 * Escape, F11 and the system chrome all exit fullscreen on their own, so the
 * only way a component's idea of its own size stays true is to listen for
 * `fullscreenchange` rather than to track what it asked for.
 */
export function useImmersive<T extends HTMLElement>() {
  const frame = useRef<T>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallback, setFallback] = useState(false);

  const immersive = nativeFullscreen || fallback;

  const enter = useCallback(async () => {
    const element = frame.current;
    if (!element) return;
    if (typeof element.requestFullscreen !== 'function') {
      setFallback(true);
      return;
    }
    try {
      await element.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Refused — some embedded and cross-origin contexts disallow it
      // outright. The overlay still gets the visitor a full-viewport canvas.
      setFallback(true);
    }
  }, []);

  const exit = useCallback(() => {
    setFallback(false);
    if (document.fullscreenElement) void document.exitFullscreen();
  }, []);

  useEffect(() => {
    const sync = () =>
      setNativeFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // Only for the fallback. Native fullscreen already takes the page out of the
  // scroll flow and handles Escape itself; a fixed overlay does neither, and a
  // page scrolling behind a full-screen canvas is disorienting on a phone.
  useEffect(() => {
    if (!fallback) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFallback(false);
    };
    window.addEventListener('keydown', onEscape);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onEscape);
    };
  }, [fallback]);

  return { frame, immersive, enter, exit };
}

/**
 * The frame's classes while it owns the viewport.
 *
 * WARNING for anyone placing a frame: `position: fixed` is relative to the
 * nearest ancestor with a `transform`, not to the viewport. `/explore` centres
 * its canvas with `left-1/2 -translate-x-1/2`, which silently turned this into
 * an absolutely-positioned box inside a 94vw column. Any wrapper's transform
 * has to come off while immersive — see `Explorer.tsx`.
 */
export const IMMERSIVE_FRAME =
  'fixed inset-0 z-[60] h-full w-full overflow-hidden rounded-none border-0';

/** One look for every control that floats over a canvas, in either scene. */
export const OVERLAY_BUTTON =
  'rounded border px-2.5 py-1 font-mono text-[11px] backdrop-blur-sm transition-colors';

export const overlayButtonStyle = (active = false) => ({
  borderColor: active ? 'rgba(61,219,160,0.7)' : 'rgba(125,135,148,0.5)',
  backgroundColor: 'rgba(9,13,16,0.7)',
  color: active ? '#3ddba0' : '#aab2bd',
});
