'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { phases } from '@/lib/chibi/timeline';

/**
 * Raphael's real Live2D rig (v21, the same one her desktop overlay runs),
 * drawn with pixi.js and the Cubism 5 runtime.
 *
 * Loaded through `next/dynamic` with `ssr: false` from ChibiStory, so pixi, the
 * plugin and the Cubism Core (self-hosted in /vendor, never a CDN: nothing on
 * the render path fetches from another host) only load on /chibi-agent, after
 * first paint.
 *
 * The zoom happens inside pixi, by scaling the model about her head, rather
 * than as a CSS transform on the canvas: an upscaled canvas goes soft, a
 * re-rendered model stays sharp at any zoom.
 */

const MODEL = '/models/raphael/raphael.model3.json';
const CORE = '/vendor/live2d/live2dcubismcore.min.js';
/**
 * Her face, as a fraction of the model's own width and height (hood top is
 * about 0.12, chin about 0.42 on the v21 rig), and where the zoom puts it.
 * Tuned by eye: the core (at 34% of the stage) lands over her hood and halo
 * with her eyes still in frame.
 */
const HEAD = { x: 0.5, y: 0.3 };
const HEAD_TARGET_Y = 0.66;
/** How far the zoom goes, as a multiple of the fitted size. */
const ZOOM = 2.4;

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
  }
}

let corePromise: Promise<void> | null = null;
function loadCore(): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve();
  corePromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CORE;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      corePromise = null;
      reject(new Error('Cubism Core failed to load'));
    };
    document.head.appendChild(s);
  });
  return corePromise;
}

type Props = {
  /** Scroll progress through the story (written by ChibiStory, read each frame). */
  progress: RefObject<number>;
  onReady?: () => void;
  onError?: (e: unknown) => void;
};

export default function Live2DStage({ progress, onReady, onError }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onReady, onError });
  useEffect(() => {
    cbs.current = { onReady, onError };
  }, [onReady, onError]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      await loadCore();
      const PIXI = await import('pixi.js');
      const { Live2DModel } = await import('@naari3/pixi-live2d-display');
      if (disposed) return;
      Live2DModel.registerTicker(PIXI.Ticker);

      // The plugin ignores pixi's `resolution`: at a device pixel ratio of 2
      // it drew her at half size, pulled toward the top-left. So pixi runs at
      // resolution 1 on a backing store sized in device pixels, the canvas is
      // sized by CSS, and the layout below works in device pixels (it only
      // uses fractions of the screen, so nothing else changes).
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const app = new PIXI.Application();
      await app.init({
        width: Math.max(1, Math.round(el.clientWidth * dpr)),
        height: Math.max(1, Math.round(el.clientHeight * dpr)),
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1,
        preference: 'webgl',
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      el.appendChild(app.canvas);
      app.canvas.setAttribute('aria-hidden', 'true');
      const ro = new ResizeObserver(() =>
        app.renderer.resize(Math.max(1, Math.round(el.clientWidth * dpr)), Math.max(1, Math.round(el.clientHeight * dpr))),
      );
      ro.observe(el);

      // Gaze is driven by hand below (window-wide, not just over the canvas).
      const model = await Live2DModel.from(MODEL, { autoHitTest: false, autoFocus: false });
      if (disposed) {
        ro.disconnect();
        app.destroy(true, { children: true });
        return;
      }
      app.stage.addChild(model);

      // Three fixes for @naari3/pixi-live2d-display 1.2.5 on pixi 8.22, each
      // found by inspecting a model that loaded fine but drew nothing:
      // 1. It looks for its renderer on `window.app` unless handed one.
      model.setRenderer(app.renderer);
      // 2. It draws from an `onRender` hook assigned before the model had a
      //    parent, which this pixi never registers with the render group, so
      //    the hook never ran. Re-assigning through the public setter, now that
      //    it's on the stage, registers it.
      // 3. Cubism leaves the GL clear colour at opaque white after drawing its
      //    masks, and pixi caches its own (transparent) clear colour instead of
      //    re-setting it, so every next frame cleared the whole stage to white.
      const gl = (app.renderer as unknown as { gl: WebGLRenderingContext }).gl;
      const draw = model.onRender;
      model.onRender = null;
      model.onRender = (renderer) => {
        draw?.call(model, renderer);
        gl.clearColor(0, 0, 0, 0);
      };
      const baseW = model.width / model.scale.x;
      const baseH = model.height / model.scale.y;

      const layout = () => {
        const { zoom } = phases(progress.current ?? 0);
        const w = app.screen.width;
        const h = app.screen.height;
        const wide = w >= 900;
        // Phones keep the top of the stage for the title (see .chibi-hero-copy).
        const fit = Math.min((h * (wide ? 0.84 : 0.6)) / baseH, (w * (wide ? 0.5 : 0.92)) / baseW);
        const s = fit * (1 + (ZOOM - 1) * zoom);
        // Rest: feet near the bottom, left of centre on wide screens.
        // Zoomed: her head lands just below the stage centre, under the core.
        const restX = wide ? w * 0.34 : w * 0.5;
        const restHead = { x: restX, y: h * 0.92 - baseH * fit * (1 - HEAD.y) };
        const target = { x: w * 0.5, y: h * HEAD_TARGET_Y };
        const hx = restHead.x + (target.x - restHead.x) * zoom;
        const hy = restHead.y + (target.y - restHead.y) * zoom;
        model.scale.set(s);
        model.position.set(hx - baseW * s * HEAD.x, hy - baseH * s * HEAD.y);
      };

      let running = true;
      const tick = () => {
        layout();
        const { her } = phases(progress.current ?? 0);
        // Hidden behind the graph: stop drawing her at all.
        if (her <= 0.001 && running) {
          running = false;
          app.ticker.stop();
        }
      };
      app.ticker.add(tick);
      // The ticker stops once she has faded out; scrolling back restarts it.
      const wake = () => {
        if (!running && phases(progress.current ?? 0).her > 0.001) {
          running = true;
          app.ticker.start();
        }
      };
      window.addEventListener('scroll', wake, { passive: true });

      // Gaze follows the pointer, as on the desktop.
      const look = (e: PointerEvent) => {
        const r = app.canvas.getBoundingClientRect();
        model.focus((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
      };
      window.addEventListener('pointermove', look, { passive: true });

      model.motion('Wave');
      cbs.current.onReady?.();

      cleanup = () => {
        ro.disconnect();
        window.removeEventListener('scroll', wake);
        window.removeEventListener('pointermove', look);
        app.destroy(true, { children: true });
      };
    })().catch((e) => {
      if (!disposed) cbs.current.onError?.(e);
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [progress]);

  return <div ref={host} className="absolute inset-0" />;
}
