'use client';

import { useEffect } from 'react';

/**
 * Phase 9.0b - the live half of the liquid-glass material.
 *
 * 1. Pointer light. One delegated `pointermove` listener for the whole
 *    document: it finds the glass pane under the pointer, marks it
 *    `data-lit` (which eases `--glint` to 1 in CSS) and writes the pointer's
 *    position into `--gx` / `--gy`, at most once per animation frame. Every
 *    visual - the specular pool, the rim catching light, the lift - is CSS
 *    reading those three values. No per-pane listeners, no React state, no
 *    re-renders.
 *
 *    Only for a fine pointer that can hover, and never under reduced motion:
 *    a highlight chasing the cursor is motion. Touch gets the static glass,
 *    plus the press squish, which is pure CSS `:active`.
 *
 * 2. Refraction. The SVG filter the CSS points at (`url(#liquid-glass)`),
 *    rendered once. Switched on by the `glass-refract` class, set here only
 *    on a Chromium engine - the one engine that renders an SVG filter inside
 *    `backdrop-filter`. Elsewhere the class never appears and the pane stays
 *    frosted rather than risking a blank backdrop.
 */

/*
 * Displacement map, as an SVG data URI stretched over the pane's box. Red
 * encodes horizontal shift, green vertical; 128 (0.5) is "no shift". Both
 * ramp away from 128 over the outer ~14% of each edge and sit at 128 across
 * the middle - so the centre of the pane is optically flat and only the rim
 * bends, which is how a thick sheet of glass behaves. The two ramps are
 * separate rectangles combined with `screen`, which adds the channels.
 */
const MAP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='r' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='rgb(255,0,0)'/><stop offset='.14' stop-color='rgb(128,0,0)'/><stop offset='.86' stop-color='rgb(128,0,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient><linearGradient id='g' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='rgb(0,255,0)'/><stop offset='.14' stop-color='rgb(0,128,0)'/><stop offset='.86' stop-color='rgb(0,128,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient></defs><rect width='100' height='100' fill='url(%23r)'/><rect width='100' height='100' fill='url(%23g)' style='mix-blend-mode:screen'/></svg>`;

function isChromium(): boolean {
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string }[] };
    }
  ).userAgentData?.brands;
  return Boolean(brands?.some((b) => /Chromium/.test(b.brand)));
}

export function GlassLight() {
  useEffect(() => {
    if (isChromium()) document.documentElement.classList.add('glass-refract');

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!canHover.matches || reduced.matches) return;

    let lit: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    let frame = 0;

    const paint = () => {
      frame = 0;
      if (!lit) return;
      const r = lit.getBoundingClientRect();
      lit.style.setProperty('--gx', `${((x - r.left) / r.width) * 100}%`);
      lit.style.setProperty('--gy', `${((y - r.top) / r.height) * 100}%`);
    };

    const light = (next: HTMLElement | null) => {
      if (next === lit) return;
      lit?.removeAttribute('data-lit');
      lit = next;
      lit?.setAttribute('data-lit', '');
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const target = event.target as Element | null;
      light(target?.closest?.<HTMLElement>('.glass') ?? null);
      if (!lit) return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => light(null);

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      light(null);
    };
  }, []);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      {/* objectBoundingBox primitives: the map covers the pane exactly, and
          the displacement scale is a fraction of the pane's size - a small
          chip and a wide readout bend in proportion. The blur is done in
          CSS before this filter runs, so no blur radius has to be expressed
          as a fraction of an unknown box. */}
      <filter
        id="liquid-glass"
        x="0"
        y="0"
        width="1"
        height="1"
        primitiveUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={`data:image/svg+xml;utf8,${MAP}`}
          x="0"
          y="0"
          width="1"
          height="1"
          preserveAspectRatio="none"
          result="map"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale="0.08"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
