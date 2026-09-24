'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { DriveStick } from './DriveStick';
import { VIEWS, type DriveInput, type Readouts, type ViewMode } from './types';

const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), {
  ssr: false,
  loading: () => (
    <div
      className="grid aspect-[4/3] w-full place-items-center rounded-lg border sm:aspect-[16/10]"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-subtle)',
      }}
    >
      <p className="font-mono text-sm" style={{ color: 'var(--fg-muted)' }}>
        Loading arena…
      </p>
    </div>
  ),
});

type Support = 'checking' | 'ok' | 'unsupported';

let cachedSupport: Support | null = null;

function readSupport(): Support {
  if (cachedSupport) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    cachedSupport =
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        ? 'ok'
        : 'unsupported';
  } catch {
    cachedSupport = 'unsupported';
  }
  return cachedSupport;
}

const NEVER_CHANGES = () => () => {};
const SERVER_SNAPSHOT = (): Support => 'checking';

const EMPTY: Readouts = {
  elapsed: 0,
  alphaCoverage: 0,
  bravoCoverage: 0,
  fusedCoverage: 0,
  alphaError: 0,
  bravoError: 0,
  alphaHeading: 0,
  bravoHeading: 0,
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function SlamExplorer() {
  const support = useSyncExternalStore(
    NEVER_CHANGES,
    readSupport,
    SERVER_SNAPSHOT,
  );

  const [view, setView] = useState<ViewMode>('fused');
  const [driving, setDriving] = useState<'alpha' | 'bravo' | null>(null);
  const [running, setRunning] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [readouts, setReadouts] = useState<Readouts>(EMPTY);

  // Drive commands live in a ref, not state: they change every frame and the
  // canvas reads them inside its own loop. Routing them through React would
  // re-render the whole panel sixty times a second to move a robot.
  const input = useRef<DriveInput>({ forward: 0, turn: 0 });
  const keys = useRef(new Set<string>());

  const onReadouts = useCallback((next: Readouts) => setReadouts(next), []);

  useEffect(() => {
    if (!driving) {
      input.current = { forward: 0, turn: 0 };
      keys.current.clear();
      return;
    }

    const recompute = () => {
      const held = keys.current;
      const forward =
        (held.has('w') || held.has('arrowup') ? 1 : 0) -
        (held.has('s') || held.has('arrowdown') ? 1 : 0);
      const turn =
        (held.has('a') || held.has('arrowleft') ? 1 : 0) -
        (held.has('d') || held.has('arrowright') ? 1 : 0);
      input.current = { forward, turn };
    };

    const isDriveKey = (key: string) =>
      [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
      ].includes(key);

    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!isDriveKey(key)) return;
      // Only swallow the arrow keys once someone has actually taken control,
      // otherwise this hijacks scrolling for every visitor on the page.
      event.preventDefault();
      keys.current.add(key);
      recompute();
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
      recompute();
    };
    // Alt-tabbing away with a key held would otherwise leave the scout driving
    // into a wall forever.
    const release = () => {
      keys.current.clear();
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
  }, [driving]);

  if (support === 'unsupported') {
    return (
      <div
        className="glass p-6 text-sm"
        style={{
          color: 'var(--fg-muted)',
        }}
      >
        <p className="font-medium" style={{ color: 'var(--fg)' }}>
          The arena needs WebGL, which this browser has turned off.
        </p>
        <p className="mt-2">
          The write-up below explains what the simulation shows and why the two
          maps disagree — which is the part worth reading anyway.
        </p>
      </div>
    );
  }

  const active = VIEWS.find((v) => v.id === view);

  return (
    <div>
      <div className="relative">
        {support === 'checking' ? (
          <div
            className="aspect-[4/3] w-full rounded-lg border sm:aspect-[16/10]"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          />
        ) : (
          <div
            className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border sm:aspect-[16/10]"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <Scene
              view={view}
              driving={driving}
              input={input}
              onReadouts={onReadouts}
              running={running}
              generation={generation}
            />

            <p
              className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px]"
              style={{ color: '#7d8794' }}
            >
              {driving
                ? 'WASD or arrows to drive · drag to orbit'
                : 'drag to orbit · scroll to zoom'}
            </p>

            {driving && (
              <DriveStick
                onChange={(next) => {
                  input.current = next;
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* View selector. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {VIEWS.map((option) => {
          const selected = option.id === view;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              aria-pressed={selected}
              className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
              style={{ color: selected ? 'var(--accent)' : 'var(--fg-muted)' }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {active && (
        <p
          className="mt-3 max-w-2xl text-sm leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
          aria-live="polite"
        >
          {active.blurb}
        </p>
      )}

      {/* Drive and run controls. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span
          className="font-mono text-[11px] tracking-wide uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Control
        </span>
        {(
          [
            [null, 'autopilot'],
            ['alpha', 'drive α'],
            ['bravo', 'drive β'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setDriving(id)}
            aria-pressed={driving === id}
            className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
            style={{ color: driving === id ? 'var(--accent)' : 'var(--fg-muted)' }}
          >
            {label}
          </button>
        ))}

        <span className="mx-1" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setRunning((prev) => !prev)}
          className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
          style={{ color: 'var(--fg-muted)' }}
        >
          {running ? 'pause' : 'resume'}
        </button>
        <button
          type="button"
          onClick={() => {
            setGeneration((n) => n + 1);
            setReadouts(EMPTY);
          }}
          className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
          style={{ color: 'var(--fg-muted)' }}
        >
          restart
        </button>
      </div>

      {/* Telemetry. The drift figures are the reason this page exists, so they
          are on screen rather than buried in the prose. */}
      <dl className="mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {[
          {
            label: 'Elapsed',
            value: `${readouts.elapsed.toFixed(0)} s`,
          },
          {
            label: 'Fused coverage',
            value: percent(readouts.fusedCoverage),
          },
          {
            label: 'α coverage / drift',
            value: `${percent(readouts.alphaCoverage)} · ${readouts.alphaError.toFixed(2)} m · ${readouts.alphaHeading.toFixed(1)}°`,
          },
          {
            label: 'β coverage / drift',
            value: `${percent(readouts.bravoCoverage)} · ${readouts.bravoError.toFixed(2)} m · ${readouts.bravoHeading.toFixed(1)}°`,
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-4 border-b pb-1 text-sm"
            style={{ borderColor: 'var(--border)' }}
          >
            <dt style={{ color: 'var(--fg-muted)' }}>{row.label}</dt>
            <dd className="text-right font-mono text-xs">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
