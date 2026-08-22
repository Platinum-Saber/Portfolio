'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { NEUTRAL, type FlightInput } from '@/lib/explore/flight';
import type { Zone } from '@/lib/explore/zones';
import { FlightSticks } from './FlightSticks';
import type { JumpRequest, Telemetry } from './Scene';

const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), {
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
        Spinning up…
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

const EMPTY: Telemetry = {
  altitude: 0,
  speed: 0,
  heading: 0,
  nearestId: null,
  nearestDistance: 0,
};

/**
 * Keyboard mapping. WASD flies, arrows handle altitude and yaw, so the two
 * hands do roughly what the two sticks do and nothing needs a modifier.
 */
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

export function Explorer({ zones }: { zones: Zone[] }) {
  const support = useSyncExternalStore(
    NEVER_CHANGES,
    readSupport,
    SERVER_SNAPSHOT,
  );

  const [flying, setFlying] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [telemetry, setTelemetry] = useState<Telemetry>(EMPTY);

  const input = useRef<FlightInput>({ ...NEUTRAL });
  // State, not a ref: the scene is a child and must not write back into its
  // parent's refs. Bumping the nonce is what makes a repeat jump to the same
  // marker register as a new request.
  const [jump, setJump] = useState<JumpRequest | null>(null);
  const held = useRef(new Set<string>());
  const frame = useRef<HTMLDivElement>(null);
  // Touch contributions are kept apart from keyboard ones so releasing a key
  // cannot cancel a stick that is still being held, and vice versa.
  const sticks = useRef({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });

  const recompute = useCallback(() => {
    const keys = held.current;
    const axis = (positive: boolean, negative: boolean) =>
      (positive ? 1 : 0) - (negative ? 1 : 0);

    const { left, right } = sticks.current;
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));

    input.current = {
      pitch: clamp(axis(keys.has('w'), keys.has('s')) + right.y),
      roll: clamp(axis(keys.has('d'), keys.has('a')) + -right.x),
      lift: clamp(
        axis(
          keys.has('arrowup') || keys.has(' '),
          keys.has('arrowdown') || keys.has('shift'),
        ) + left.y,
      ),
      yaw: clamp(axis(keys.has('arrowleft'), keys.has('arrowright')) + left.x),
    };
  }, []);

  const onEnter = useCallback((id: string | null) => {
    setActiveId(id);
    if (!id) return;
    setDiscovered((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  const onTelemetry = useCallback((next: Telemetry) => setTelemetry(next), []);

  /**
   * Taking control also brings the world fully into view. Without this you can
   * be flying a canvas whose top half is behind the sticky header and whose
   * bottom half is below the fold — and the panels, which are clamped to the
   * canvas, end up hidden under the nav bar rather than misplaced.
   */
  const takeControl = useCallback(() => {
    setFlying(true);
    frame.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      if (!(key in KEYS)) return;
      // Only once control has been taken — otherwise this steals the space bar
      // and the arrow keys from anyone trying to scroll the page.
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
  }, [flying, recompute]);

  if (support === 'unsupported') {
    return (
      <div
        className="rounded-lg border p-6 text-sm"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--bg-subtle)',
          color: 'var(--fg-muted)',
        }}
      >
        <p className="font-medium" style={{ color: 'var(--fg)' }}>
          The world needs WebGL, which this browser has turned off.
        </p>
        <p className="mt-2">
          Everything hidden in it is written out below — the flying is the fun
          part, not the content.
        </p>
      </div>
    );
  }

  const found = discovered.size;
  const total = zones.length;
  const nearest = zones.find((zone) => zone.id === telemetry.nearestId);

  return (
    <div>
      <div
        ref={frame}
        // Portrait on phones. At 4:3 a 390px-wide screen leaves barely 290px of
        // sky, and the two thumb sticks sit in most of it.
        className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border sm:aspect-[16/9]"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--bg-subtle)',
        }}
      >
        {support === 'ok' && (
          <Scene
            zones={zones}
            input={input}
            flying={flying}
            onEnter={onEnter}
            onTelemetry={onTelemetry}
            jump={jump}
            activeId={activeId}
            discovered={discovered}
          />
        )}

        {/* Discovery counter. */}
        <div className="pointer-events-none absolute top-3 left-3">
          <p className="font-mono text-[11px]" style={{ color: '#7d8794' }}>
            {found} of {total} found
          </p>
          {nearest && !activeId && (
            <p
              className="mt-1 font-mono text-[11px]"
              style={{ color: '#3ddba0' }}
            >
              {nearest.label} · {telemetry.nearestDistance.toFixed(0)} m
            </p>
          )}
        </div>

        {/* Instruments. */}
        {flying && (
          <p
            className="pointer-events-none absolute top-3 right-3 text-right font-mono text-[11px]"
            style={{ color: '#7d8794' }}
          >
            alt {telemetry.altitude.toFixed(1)} m
            <br />
            {telemetry.speed.toFixed(1)} m/s
            <br />
            hdg {telemetry.heading.toFixed(0).padStart(3, '0')}
          </p>
        )}

        {!flying && support === 'ok' && (
          <div className="absolute inset-0 grid place-items-center bg-[rgba(11,14,17,0.55)] p-6 text-center">
            <div>
              <button
                type="button"
                onClick={takeControl}
                className="rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#3ddba0', color: '#08120e' }}
              >
                Take control
              </button>
              <p className="mt-3 text-xs" style={{ color: '#9aa1ac' }}>
                WASD to fly, arrow keys for altitude and yaw. On a phone, two
                thumb sticks appear.
              </p>
            </div>
          </div>
        )}

        {flying && (
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
      </div>

      {/*
        The jump list. Not a convenience — the point. Flying is a way to read
        this site, never a requirement, and nobody should have to be good at it
        to reach the contact details.
      */}
      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            className="font-mono text-[11px] tracking-widest uppercase"
            style={{ color: 'var(--fg-muted)' }}
          >
            Locations
          </h2>
          {flying && (
            <button
              type="button"
              onClick={() => setFlying(false)}
              className="font-mono text-[11px] hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              release controls
            </button>
          )}
        </div>

        <ul className="mt-3 flex flex-wrap gap-2">
          {zones.map((zone) => {
            const seen = discovered.has(zone.id);
            return (
              <li key={zone.id}>
                <button
                  type="button"
                  onClick={() => {
                    setJump((previous) => ({
                      id: zone.id,
                      nonce: (previous?.nonce ?? 0) + 1,
                    }));
                    takeControl();
                  }}
                  className="rounded border px-2.5 py-1.5 font-mono text-[11px] transition-colors"
                  style={{
                    borderColor: seen ? 'var(--accent)' : 'var(--border)',
                    color: seen ? 'var(--accent)' : 'var(--fg-muted)',
                  }}
                  title={`Fly to ${zone.title}`}
                >
                  {seen ? '● ' : '○ '}
                  {zone.label}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
          Or skip the flying entirely — everything in the world is written out
          below, and the ordinary pages are at{' '}
          <Link
            href="/projects"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            /projects
          </Link>
          ,{' '}
          <Link
            href="/about"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            /about
          </Link>{' '}
          and{' '}
          <Link
            href="/contact"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            /contact
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
