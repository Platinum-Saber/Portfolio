'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NEUTRAL, type FlightInput } from '@/lib/explore/flight';
import { STATIONS } from '@/lib/explore/lab';
import type { Zone } from '@/lib/explore/zones';
import { FlightSticks } from '../FlightSticks';
import { useWebGLSupport } from '../useWebGLSupport';
import {
  exitButtonStyle,
  IMMERSIVE_FRAME,
  OVERLAY_BUTTON,
  overlayButtonStyle,
  useImmersive,
} from '../useImmersive';
import type { JumpRequest, LabTelemetry } from './LabScene';
import { AudioToggle } from '../../AudioToggle';
import { engine, engineOff } from '@/lib/audio';
import { MAX_SPEED } from '@/lib/explore/labFlight';

const LabScene = dynamic(() => import('./LabScene').then((m) => m.LabScene), {
  ssr: false,
  loading: () => (
    <div
      className="grid aspect-[3/4] w-full place-items-center rounded-lg border sm:aspect-[16/9]"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-subtle)',
      }}
    >
      <p className="font-mono text-sm" style={{ color: 'var(--fg-muted)' }}>
        Powering up…
      </p>
    </div>
  ),
});

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return coarse;
}

const EMPTY: LabTelemetry = {
  speed: 0,
  heading: 0,
  nearestId: null,
  nearestDistance: 0,
};

const KEYS: Record<string, keyof FlightInput | undefined> = {
  w: 'pitch',
  s: 'pitch',
  a: 'roll',
  d: 'roll',
  arrowup: 'lift',
  arrowdown: 'lift',
  arrowleft: 'yaw',
  arrowright: 'yaw',
  ' ': 'lift',
  shift: 'lift',
};

export function LabExplorer({ zones }: { zones: Zone[] }) {
  const support = useWebGLSupport();
  const coarsePointer = useCoarsePointer();
  const router = useRouter();

  const [flying, setFlying] = useState(false);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<LabTelemetry>(EMPTY);
  const [jump, setJump] = useState<JumpRequest | null>(null);

  const input = useRef<FlightInput>({ ...NEUTRAL });
  const held = useRef(new Set<string>());
  const { frame, immersive, enter, exit } = useImmersive<HTMLDivElement>();
  const sticks = useRef({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });

  const projects = zones.filter((zone) => zone.kind === 'project');
  // Read inside the key handler, which is registered once - a ref keeps it
  // seeing the current values without re-binding listeners on every render.
  // Written in an effect rather than during render: React may render without
  // committing, and a ref updated on an abandoned render is a lie the handler
  // would then act on.
  const latest = useRef({ projects, selectedProject, activeStation });
  useEffect(() => {
    latest.current = { projects, selectedProject, activeStation };
  });

  const recompute = useCallback(() => {
    const keys = held.current;
    const axis = (positive: boolean, negative: boolean) =>
      (positive ? 1 : 0) - (negative ? 1 : 0);
    const { left, right } = sticks.current;
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));

    // While the terminal is open the arrow keys belong to the list, so
    // altitude falls back to space and shift alone. Documented in the legend
    // below, because a control that silently changes meaning is worse than one
    // that never worked.
    const listHasArrows = latest.current.activeStation === 'projects';

    input.current = {
      pitch: clamp(axis(keys.has('w'), keys.has('s')) + right.y),
      roll: clamp(axis(keys.has('d'), keys.has('a')) + -right.x),
      lift: clamp(
        axis(
          keys.has(' ') || (!listHasArrows && keys.has('arrowup')),
          keys.has('shift') || (!listHasArrows && keys.has('arrowdown')),
        ) + left.y,
      ),
      yaw: clamp(axis(keys.has('arrowleft'), keys.has('arrowright')) + left.x),
    };
  }, []);

  const onStation = useCallback((id: string | null) => {
    setActiveStation(id);
    // Leaving the terminal resets it to the list. Coming back to a detail view
    // you opened two minutes ago and have no memory of is disorienting.
    if (id !== 'projects') setSelectedProject(null);
  }, []);

  const onTelemetry = useCallback((next: LabTelemetry) => {
    setTelemetry(next);
    // Same call as the outdoor world, against this room's own much lower
    // ceiling (2.2 m/s against 17) - so a slow indoor drift sounds like one,
    // rather than like an idling version of the outdoor craft.
    engine(next.speed / MAX_SPEED);
  }, []);

  useEffect(() => {
    if (!flying) engineOff();
  }, [flying]);
  useEffect(() => engineOff, []);

  const onOpenProject = useCallback(
    (id: string) => router.push(`/projects/${id}`),
    [router],
  );

  const takeControl = useCallback(() => {
    setFlying(true);
    void enter();
    frame.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [enter, frame]);

  const goTo = useCallback((id: string) => {
    setFlying(true);
    setJump({ id, nonce: Date.now() });
  }, []);

  useEffect(() => {
    if (!flying) {
      held.current.clear();
      sticks.current = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
      input.current = { ...NEUTRAL };
      return;
    }

    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const state = latest.current;

      // Terminal navigation takes priority over flight for these three keys,
      // and only while the terminal is actually open.
      if (state.activeStation === 'projects') {
        const list = state.projects;
        const index = list.findIndex(
          (project) => project.id === state.selectedProject,
        );

        if (key === 'arrowdown' || key === 'arrowup') {
          event.preventDefault();
          const step = key === 'arrowdown' ? 1 : -1;
          const next =
            index === -1 ? (step === 1 ? 0 : list.length - 1) : index + step;
          const wrapped = ((next % list.length) + list.length) % list.length;
          setSelectedProject(list[wrapped]?.id ?? null);
          return;
        }
        if (key === 'enter' && state.selectedProject) {
          event.preventDefault();
          router.push(`/projects/${state.selectedProject}`);
          return;
        }
        if (key === 'escape' && state.selectedProject) {
          event.preventDefault();
          setSelectedProject(null);
          return;
        }
      }

      if (!(key in KEYS)) return;
      event.preventDefault();
      held.current.add(key);
      recompute();
    };
    const up = (event: KeyboardEvent) => {
      held.current.delete(event.key.toLowerCase());
      recompute();
    };
    const release = () => {
      held.current.clear();
      recompute();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [flying, recompute, router]);

  if (support === 'unsupported') {
    return (
      <div className="glass p-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
        <p>
          The lab needs WebGL, which this browser has turned off. Nothing is
          lost - every station in the room is written out in full below, and the
          projects are all on{' '}
          <Link
            href="/projects"
            className="hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            the projects page
          </Link>
          .
        </p>
      </div>
    );
  }

  const nearLabel =
    telemetry.nearestId &&
    STATIONS.find((station) => station.id === telemetry.nearestId)?.label;

  return (
    <div>
      <div
        ref={frame}
        className={
          immersive
            ? IMMERSIVE_FRAME
            : 'relative aspect-[3/4] w-full overflow-hidden rounded-lg border sm:aspect-[16/9]'
        }
        style={{
          borderColor: immersive ? 'transparent' : 'var(--border)',
          backgroundColor: immersive ? '#05070a' : 'var(--bg-subtle)',
        }}
      >
        {support === 'ok' && (
          <LabScene
            zones={zones}
            input={input}
            flying={flying}
            onStation={onStation}
            onTelemetry={onTelemetry}
            jump={jump}
            activeStation={activeStation}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            onOpenProject={onOpenProject}
          />
        )}

        <div
          className="pointer-events-none absolute top-3 left-3 z-10 font-mono text-[11px]"
          style={{ color: '#7d8794' }}
        >
          <p>{activeStation ? 'station open' : 'flying'}</p>
          {nearLabel && (
            <p style={{ color: '#3ddba0' }}>
              {nearLabel} · {telemetry.nearestDistance.toFixed(1)} m
            </p>
          )}
          {/* Same corner as `/explore`, so the control is in one place across
              both flight scenes rather than wherever each layout had a gap. */}
          <div className="pointer-events-auto mt-2">
            <AudioToggle />
          </div>
        </div>

        {!flying && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <button
                type="button"
                onClick={takeControl}
                className="glass glass-btn glass-press glass-accent glass-blur hud px-4 py-2 text-sm font-semibold"
              >
                Take control
              </button>
              <p className="mt-2 text-xs" style={{ color: '#aab2bd' }}>
                Fills the screen. Fly to the console for the projects.
              </p>
            </div>
          </div>
        )}

        {/*
          While the canvas fills the viewport the nav below it is off-screen,
          and that nav is the accessible route to every station. It follows the
          canvas in rather than being left behind - a fullscreen mode that
          quietly removes the keyboard-and-pointer path to the content would be
          a regression dressed as a feature.
        */}
        {immersive && (
          <div className="pointer-events-auto absolute top-3 right-3 z-50 flex flex-wrap justify-end gap-2">
            {STATIONS.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => goTo(station.id)}
                className={OVERLAY_BUTTON}
                style={overlayButtonStyle(activeStation === station.id)}
              >
                {station.label}
              </button>
            ))}
            <button
              type="button"
              onClick={exit}
              className={OVERLAY_BUTTON}
              style={exitButtonStyle}
            >
              exit ✕
            </button>
          </div>
        )}

        {flying && coarsePointer && (
          <FlightSticks
            onLeft={(axes) => {
              sticks.current.left = axes;
              recompute();
            }}
            onRight={(axes) => {
              sticks.current.right = axes;
              recompute();
            }}
          />
        )}

        {flying && !coarsePointer && (
          <div
            className="pointer-events-none absolute right-3 bottom-3 text-right font-mono text-[11px]"
            style={{ color: '#7d8794' }}
          >
            <p>move W A S D</p>
            <p>altitude space / shift</p>
            <p>yaw ← →</p>
            <p>
              {activeStation === 'projects'
                ? 'list ↑ ↓ · open enter'
                : 'altitude also ↑ ↓'}
            </p>
            {immersive && <p>esc to leave fullscreen</p>}
          </div>
        )}
      </div>

      {/*
        The accessible route to every station. Nothing in this room is reachable
        only by flying well: each button puts the craft at that station's
        approach anchor, which opens it.
      */}
      <nav
        className="mt-4 flex flex-wrap gap-2"
        /* Hidden rather than unmounted while the canvas is fullscreen: these
           are the same buttons rendered inside the frame, and unmounting them
           would move focus. */
        hidden={immersive}
      >
        {STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            onClick={() => goTo(station.id)}
            className="glass glass-btn glass-press px-2.5 py-1 font-mono text-[11px]"
            style={{
              color:
                activeStation === station.id
                  ? 'var(--accent)'
                  : 'var(--fg-muted)',
            }}
          >
            {station.label}
          </button>
        ))}
        {flying && (
          <button
            type="button"
            onClick={() => setFlying(false)}
            className="glass glass-btn glass-press px-2.5 py-1 font-mono text-[11px]"
            style={{ color: 'var(--fg-muted)' }}
          >
            release controls
          </button>
        )}
      </nav>
    </div>
  );
}
