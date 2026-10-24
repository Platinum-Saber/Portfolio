'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { allPaths, coreDemo, hashToPath, intro, nodeAt, pathToHash } from '@/lib/chibi/graph';
import { PHASE, beat, phases, voiceLevel } from '@/lib/chibi/timeline';
import { ramp, useReducedMotion, useScrollProgress } from '@/lib/chibi/useScrollProgress';
import type { CoreInput } from '@/lib/chibi/coreFx';
import { ArchitectureGraph, nodeDomId } from './ArchitectureGraph';
import { CoreCanvas } from './CoreCanvas';
import { NodePanel } from './NodePanel';
import { OrbitChips } from './OrbitChips';
import { SpriteStage } from './SpriteStage';

const QUIET: CoreInput = { thinking: false, speaking: false, level: 0 };
const NONE: string[] = [];

/**
 * The /chibi-agent scroll story. One sticky stage, one timeline (see
 * lib/chibi/timeline.ts): Raphael with her capabilities orbiting her, a zoom
 * into her head where the thinking core thinks and then speaks, and the core
 * settling in the middle of the architecture, a tree you can walk into.
 *
 * Per-frame work never goes through React: scroll writes CSS variables on the
 * stage and a progress ref that her sprite, the chips and the core read
 * themselves. React state changes only when a phase boundary is crossed or a
 * node is opened.
 *
 * Reduced motion gets no scroll-driven zoom at all: a still hero, then the
 * graph, already drawn, with a still core.
 */
export function ChibiStory() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const herBox = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  const phaseLabel = useRef<HTMLParagraphElement>(null);
  const progress = useRef(0);
  const hover = useRef<string | null>(null);
  const openRef = useRef<string[]>(NONE); // the open path, readable from the scroll callback
  const clock = useRef(0);
  const graphClock = useRef(0);

  const [interactive, setInteractive] = useState(false);
  const [path, setPath] = useState<string[]>(NONE);

  const onFrame = useCallback((p: number) => {
    progress.current = p;
    const ph = phases(p);
    const el = stage.current;
    if (!el) return;
    const s = el.style;
    s.setProperty('--hero', ph.hero.toFixed(4));
    s.setProperty('--zoom', ph.zoom.toFixed(4));
    s.setProperty('--her', ph.her.toFixed(4));
    s.setProperty('--graph', ph.graph.toFixed(4));
    s.setProperty('--cap', (ramp(ph.demo, 0.02, 0.12) * (1 - ph.graph)).toFixed(4));
    const speaking = ph.demo >= 0.5;
    if (phaseLabel.current) phaseLabel.current.textContent = speaking ? coreDemo.speaking : coreDemo.thinking;
    if (caption.current) {
      const n = Math.round(coreDemo.caption.length * ramp(ph.demo, 0.5, 0.95));
      caption.current.textContent = speaking ? coreDemo.caption.slice(0, Math.max(1, n)) : '…';
    }
    const live = p >= PHASE.interactive;
    setInteractive(live);
    if (!live && openRef.current.length) {
      // Scrolled back up past the graph: close what was open, and its #hash.
      openRef.current = NONE;
      setPath(NONE);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
  useScrollProgress(section, onFrame, !reduced);

  // The story's core: thinking while the zoom lands, then speaking with the
  // same made-up level that moves her mouth (there is no audio here).
  const storyCore = useCallback((dt: number): CoreInput => {
    clock.current += dt;
    const b = beat(phases(progress.current));
    if (b === 'quiet') return QUIET;
    if (b === 'thinking') return { thinking: true, speaking: false, level: 0 };
    return { thinking: false, speaking: true, level: voiceLevel(clock.current) };
  }, []);

  // The graph's core: a calm pulse, livelier while a node is hovered or open.
  const graphCore = useCallback(
    (dt: number): CoreInput => {
      graphClock.current += dt;
      const base = hover.current || path.length ? 0.55 : 0.16;
      return { thinking: false, speaking: true, level: base + 0.08 * Math.sin(graphClock.current * 2.1) };
    },
    [path],
  );

  const open = useCallback((next: string[]) => {
    const prev = openRef.current;
    openRef.current = next;
    setPath(next);
    if (next.length < prev.length) {
      // Going back up: focus returns to the node that was open, once it is laid out again.
      setTimeout(() => document.getElementById(nodeDomId(prev))?.focus({ preventScroll: true }), 0);
    }
    const url = next.length ? `#${pathToHash(next)}` : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }, []);

  useEffect(() => {
    if (!path.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open(openRef.current.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path, open]);

  // Deep links (/chibi-agent#voice/cloned). Each node has a real anchor where
  // the graph is fully drawn (below), so the browser can jump there by itself;
  // this repeats the jump after hydration, which can reset the scroll, then
  // opens the node. The orbit chips use the same route.
  useEffect(() => {
    let t = 0;
    const go = () => {
      const next = hashToPath(window.location.hash);
      if (!next.length || !nodeAt(next) || pathToHash(next) === pathToHash(openRef.current)) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        document.getElementById(pathToHash(next))?.scrollIntoView({ behavior: 'instant', block: 'start' });
        requestAnimationFrame(() => {
          setInteractive(true);
          openRef.current = next;
          setPath(next);
        });
      }, 60);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', go);
    };
  }, [reduced]);

  // The story is up: hide the plain-HTML fallback below it (DeepDive). If this
  // component never mounts (no JS, or it threw), the fallback stays visible.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.chibiReady = '';
    return () => {
      delete root.dataset.chibiReady;
    };
  }, []);

  const pick = useCallback((id: string) => {
    window.location.hash = id;
  }, []);

  const anchors = (style: CSSProperties) =>
    allPaths().map((p) => (
      <span key={pathToHash(p)} id={pathToHash(p)} aria-hidden className="pointer-events-none absolute left-0" style={style} />
    ));
  const panel = path.length > 0 && <NodePanel path={path} onPath={open} />;
  const graph = (live: boolean, coreStill: boolean) => (
    <ArchitectureGraph
      path={path}
      onPath={open}
      onHover={(id) => {
        hover.current = id;
      }}
      interactive={live}
      coreSlot={<CoreCanvas drive={graphCore} still={coreStill} radius={0.26} className="absolute inset-0 h-full w-full" />}
    />
  );

  if (reduced) {
    return (
      <div className="chibi-bleed">
        <section className="chibi-stage hud relative isolate overflow-hidden">
          <div className="relative mx-auto grid min-h-[80svh] max-w-6xl items-center gap-8 px-4 py-16 sm:grid-cols-2 sm:px-8">
            <div ref={herBox} className="relative z-[2] mx-auto h-[64svh]">
              <SpriteStage progress={progress} still className="h-full" />
            </div>
            <Hero />
          </div>
          <OrbitChips around={herBox} progress={progress} onPick={pick} still />
        </section>
        <section className="chibi-stage hud relative isolate h-[100svh] overflow-hidden" style={{ '--graph': 1 } as CSSProperties} aria-label="Architecture">
          {anchors({ top: 0 })}
          {graph(true, true)}
          {panel}
        </section>
      </div>
    );
  }

  return (
    <div className="chibi-bleed">
      <section ref={section} className="relative" style={{ height: '450svh' }} aria-label="Raphael, from character to architecture">
        {/* Deep-link targets: one viewport above the end, where the graph is live. */}
        {anchors({ top: 'calc(100% - 100svh)' })}
        <div
          ref={stage}
          className="chibi-stage hud sticky top-0 isolate h-[100svh] overflow-hidden"
          style={{ '--hero': 1, '--zoom': 0, '--her': 1, '--graph': 0, '--cap': 0 } as CSSProperties}
        >
          {/* Her, between the far and near halves of the orbit */}
          <div className="chibi-her pointer-events-none absolute inset-0 z-[2]">
            <div ref={herBox} className="chibi-sprite-box absolute">
              <SpriteStage progress={progress} className="h-full" />
            </div>
          </div>
          <OrbitChips around={herBox} progress={progress} onPick={pick} />

          <div className="chibi-hero-copy absolute z-[4]">
            <Hero />
          </div>

          <p className="chibi-scroll-cue absolute inset-x-0 bottom-6 text-center font-mono text-[11px] tracking-[0.2em] uppercase" aria-hidden>
            Scroll
          </p>

          {/* The core over her head, then moving to the centre */}
          <div className="chibi-story-core absolute z-[5]" aria-hidden>
            <CoreCanvas drive={storyCore} radius={0.26} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="chibi-caption absolute z-[5]" aria-live="off">
            <p ref={phaseLabel} className="font-mono text-[11px] tracking-[0.12em] text-[var(--chibi-cyan)] uppercase">
              {coreDemo.thinking}
            </p>
            <p ref={caption} className="chibi-glass glass glass-blur mt-2 px-4 py-3 font-mono text-[13px] leading-relaxed">
              …
            </p>
          </div>

          {/* The architecture */}
          <div className="chibi-graph-layer absolute inset-x-0 top-16 bottom-0 z-[6]" data-live={interactive ? '' : undefined}>
            {graph(interactive, false)}
            {interactive && !path.length && (
              <p className="chibi-hint pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
                Select a node to walk in
              </p>
            )}
          </div>
          {panel}
        </div>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <div className="max-w-md">
      <p className="font-mono text-xs tracking-[0.18em] text-[var(--chibi-cyan)] uppercase">{intro.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{intro.title}</h1>
      <p className="mt-2 text-lg text-[var(--fg)]">{intro.subtitle}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--fg-muted)]">{intro.body}</p>
    </div>
  );
}
