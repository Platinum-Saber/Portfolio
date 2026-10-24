'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { allNodes, capabilities, coreDemo, intro, nodeById } from '@/lib/chibi/graph';
import { PHASE, phases } from '@/lib/chibi/timeline';
import { ramp, useReducedMotion, useScrollProgress } from '@/lib/chibi/useScrollProgress';
import type { CoreInput } from '@/lib/chibi/coreFx';
import { useWebGLSupport } from '../explore/useWebGLSupport';
import { ArchitectureGraph } from './ArchitectureGraph';
import { CoreCanvas } from './CoreCanvas';
import { NodePanel } from './NodePanel';

const Live2DStage = dynamic(() => import('./Live2DStage'), { ssr: false, loading: () => null });

const STILL = '/images/raphael-still.webp';
const QUIET: CoreInput = { thinking: false, speaking: false, level: 0 };

/**
 * The /chibi-agent scroll story. One sticky stage, one timeline (see
 * lib/chibi/timeline.ts): Raphael with her capabilities around her, a zoom
 * into her head where the thinking core thinks and then speaks, and the core
 * settling in the middle of the architecture graph, which becomes clickable.
 *
 * Per-frame work never goes through React: scroll writes CSS variables on the
 * stage and a progress ref that the Live2D stage and the core read themselves.
 * React state changes only when a phase boundary is crossed.
 *
 * Reduced motion gets no scroll-driven zoom at all: a still hero, then the
 * graph, already drawn, with a still core.
 */
export function ChibiStory() {
  const reduced = useReducedMotion();
  const webgl = useWebGLSupport();
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  const phaseLabel = useRef<HTMLParagraphElement>(null);
  const progress = useRef(0);
  const hover = useRef<string | null>(null);
  const openRef = useRef<string | null>(null); // `selected`, readable from the scroll callback
  const clock = useRef(0);
  const graphClock = useRef(0);

  const [interactive, setInteractive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [herState, setHerState] = useState<'loading' | 'ready' | 'failed'>('loading');

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
    if (!live && openRef.current) {
      // Scrolled back up past the graph: close what was open, and its #hash.
      openRef.current = null;
      setSelected(null);
      setBranch(null);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
  useScrollProgress(section, onFrame, !reduced);

  // The story's core: thinking while the zoom lands, speaking through the
  // second half of the demo (a made-up voice level: there is no audio here).
  const storyCore = useCallback((dt: number): CoreInput => {
    clock.current += dt;
    const ph = phases(progress.current);
    if (ph.zoom < 0.55 || ph.graph > 0.98) return QUIET;
    if (ph.demo < 0.5) return { thinking: true, speaking: false, level: 0 };
    const t = clock.current;
    return { thinking: false, speaking: true, level: 0.3 + 0.5 * Math.abs(Math.sin(t * 7.3)) * (0.6 + 0.4 * Math.sin(t * 1.7)) };
  }, []);

  // The graph's core: a calm pulse, livelier while a node is hovered or focused.
  const graphCore = useCallback((dt: number): CoreInput => {
    graphClock.current += dt;
    const t = graphClock.current;
    const base = hover.current || selected ? 0.55 : 0.16;
    return { thinking: false, speaking: true, level: base + 0.08 * Math.sin(t * 2.1) };
  }, [selected]);

  const select = useCallback((id: string | null) => {
    const prev = openRef.current;
    openRef.current = id;
    setSelected(id);
    setBranch(null);
    if (!id && prev) {
      // Give focus back to the node that was open, once the panel has gone.
      const back = prev === 'core' ? '.chibi-core-hit' : `#chibi-node-${prev}`;
      setTimeout(() => document.querySelector<HTMLElement>(back)?.focus({ preventScroll: true }), 0);
    }
    const url = id ? `#${id}` : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, select]);

  // Deep links (/chibi-agent#memory). Each node has a real anchor where the
  // graph is fully drawn (below), so the browser can jump there by itself; this
  // repeats the jump after hydration, which can reset the scroll, then opens it.
  useEffect(() => {
    let t = 0;
    const open = () => {
      const id = window.location.hash.slice(1);
      if (!id || !nodeById(id) || id === openRef.current) return;
      clearTimeout(t);
      t = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
        requestAnimationFrame(() => {
          setInteractive(true);
          openRef.current = id;
          setSelected(id);
          setBranch(null);
        });
      }, 60);
    };
    open();
    window.addEventListener('hashchange', open);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', open);
    };
  }, [reduced]);

  const node = selected ? nodeById(selected) : null;
  const showLive2D = !reduced && webgl === 'ok' && herState !== 'failed';
  const showStill = reduced || webgl === 'unsupported' || herState !== 'ready';

  const panel = node && (
    <NodePanel node={node} openBranch={branch} onBranch={setBranch} onClose={() => select(null)} />
  );
  const graph = (live: boolean, coreStill: boolean) => (
    <ArchitectureGraph
      selected={selected}
      onSelect={select}
      onBranch={setBranch}
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
        <section className="chibi-stage hud relative isolate overflow-hidden" style={{ '--hero': 1 } as CSSProperties}>
          <div className="relative mx-auto grid min-h-[80svh] max-w-6xl items-center gap-8 px-4 py-16 sm:grid-cols-2 sm:px-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimiser */}
            <img src={STILL} alt="Raphael, a chibi character in a dark robe" className="mx-auto max-h-[64svh] w-auto" />
            <Hero />
          </div>
        </section>
        <section className="chibi-stage hud relative isolate h-[100svh] overflow-hidden" style={{ '--graph': 1 } as CSSProperties} aria-label="Architecture">
          {allNodes.map((n) => (
            <span key={n.id} id={n.id} aria-hidden className="absolute top-0" />
          ))}
          {graph(true, true)}
          {panel}
        </section>
      </div>
    );
  }

  return (
    <div className="chibi-bleed">
      <section ref={section} className="relative" style={{ height: '450svh' }} aria-label="Raphael, from character to architecture">
        {allNodes.map((n) => (
          // Deep-link targets: one viewport above the end, where the graph is live.
          <span key={n.id} id={n.id} aria-hidden className="pointer-events-none absolute left-0" style={{ top: 'calc(100% - 100svh)' }} />
        ))}
        <div
          ref={stage}
          className="chibi-stage hud sticky top-0 isolate h-[100svh] overflow-hidden"
          style={{ '--hero': 1, '--zoom': 0, '--her': 1, '--graph': 0, '--cap': 0 } as CSSProperties}
        >
          {/* Her */}
          <div className="chibi-her absolute inset-0">
            {showStill && (
              // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimiser
              <img src={STILL} alt="" aria-hidden className="chibi-still" onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
            {showLive2D && (
              <Live2DStage
                progress={progress}
                onReady={() => setHerState('ready')}
                onError={(e) => {
                  console.warn('Live2D stage unavailable:', e);
                  setHerState('failed');
                }}
              />
            )}
          </div>

          {/* Capabilities orbiting her */}
          <div className="chibi-orbit pointer-events-none absolute" aria-hidden>
            <div className="chibi-orbit-ring">
              {capabilities.map((c, i) => (
                <span
                  key={c.id}
                  className="chibi-cap glass-chip font-mono"
                  style={{ '--a': `${(360 / capabilities.length) * i - 90}deg` } as CSSProperties}
                >
                  <span className="chibi-cap-in">{c.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="chibi-hero-copy absolute">
            <Hero />
          </div>

          <p className="chibi-scroll-cue absolute inset-x-0 bottom-6 text-center font-mono text-[11px] tracking-[0.2em] uppercase" aria-hidden>
            Scroll
          </p>

          {/* The core over her head, then moving to the centre */}
          <div className="chibi-story-core absolute" aria-hidden>
            <CoreCanvas drive={storyCore} radius={0.26} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="chibi-caption absolute" aria-live="off">
            <p ref={phaseLabel} className="font-mono text-[11px] tracking-[0.12em] text-[var(--chibi-cyan)] uppercase">
              {coreDemo.thinking}
            </p>
            <p ref={caption} className="chibi-glass glass glass-blur mt-2 px-4 py-3 font-mono text-[13px] leading-relaxed">
              …
            </p>
          </div>

          {/* The architecture */}
          <div className="chibi-graph-layer absolute inset-x-0 top-16 bottom-0" data-live={interactive ? '' : undefined}>
            {graph(interactive, false)}
            {interactive && !selected && (
              <p className="chibi-hint pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
                Select a node to zoom in
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
