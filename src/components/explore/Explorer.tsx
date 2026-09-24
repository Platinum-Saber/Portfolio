'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NEUTRAL, type FlightInput } from '@/lib/explore/flight';
import type { Zone } from '@/lib/explore/zones';
import { FlightSticks } from './FlightSticks';
import { useWebGLSupport } from './useWebGLSupport';
import {
  IMMERSIVE_FRAME,
  OVERLAY_BUTTON,
  overlayButtonStyle,
  useImmersive,
} from './useImmersive';
import type { JumpRequest, Telemetry } from './Scene';
import { AudioToggle } from '../AudioToggle';
import { engine, engineOff } from '@/lib/audio';
import { MAX_SPEED } from '@/lib/explore/flight';

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

/**
 * Whether the primary pointer is a finger.
 *
 * It decides which control surface is offered: thumb sticks on touch, a
 * keyboard legend on a mouse. Showing both put two large stick pads in the
 * bottom corners of a desktop screen that nobody was ever going to drag.
 */
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

const KEY_LEGEND: ReadonlyArray<[string, string]> = [
  ['W A S D', 'move'],
  ['↑ ↓', 'altitude'],
  ['← →', 'yaw'],
];

const EMPTY: Telemetry = {
  altitude: 0,
  speed: 0,
  heading: 0,
  nearestId: null,
  nearestDistance: 0,
  guidingTo: null,
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
  const support = useWebGLSupport();
  const coarsePointer = useCoarsePointer();

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
  const { frame, immersive, enter, exit } = useImmersive<HTMLDivElement>();
  const router = useRouter();
  // Whether this visit arrived already-flying from the home portal. A ref
  // rather than state: nothing renders from it, and flipping it must not
  // schedule a render in the middle of leaving.
  const deepLinked = useRef(false);
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

  const onTelemetry = useCallback((next: Telemetry) => {
    setTelemetry(next);
    // The audio module ignores this entirely until the visitor arms it, so
    // this call costs a function invocation and nothing else in the default,
    // silent case. Normalised here rather than inside the engine so the audio
    // never has to know how fast this particular craft goes.
    // Guided flight (9.2) runs faster than a visitor can fly; the engine
    // tops out at full throttle rather than being driven past it.
    engine(Math.min(1, next.speed / MAX_SPEED));
  }, []);

  // Flight stopping — leaving fullscreen, unmounting, navigating away — has to
  // take the engine down with it. A tone that outlives the thing making it is
  // the single worst bug this feature could ship.
  useEffect(() => {
    if (!flying) engineOff();
  }, [flying]);
  useEffect(() => engineOff, []);

  /**
   * Taking control also brings the world fully into view. Without this you can
   * be flying a canvas whose top half is behind the sticky header and whose
   * bottom half is below the fold — and the panels, which are clamped to the
   * canvas, end up hidden under the nav bar rather than misplaced.
   */
  const takeControl = useCallback(() => {
    setFlying(true);
    void enter();
    frame.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [enter, frame]);

  /**
   * Arriving with intent — `/explore?fly=1`.
   *
   * The home portal's button already says "Take control". Landing here on a
   * second button with the same words, and having to press it again, reads as
   * the first press having failed. The portal therefore deep-links with
   * `?fly=1` and this skips the gate. `/explore` reached from the nav, or
   * typed, has no such param and still gets the gate: nobody is handed ~1.9 MB
   * for browsing to a page.
   *
   * `window.location` inside an effect rather than `useSearchParams()`: that
   * hook opts the route out of static prerendering unless it is wrapped in a
   * Suspense boundary, and every page on this site is prerendered.
   *
   * The fullscreen request rides the *navigation's* activation rather than a
   * local click, and a browser may decline it. `useImmersive` already treats a
   * refusal as the fixed-overlay case, so the visitor gets a full-viewport
   * canvas either way — which is the part that matters.
   */
  useEffect(() => {
    if (support !== 'ok') return;
    if (new URLSearchParams(window.location.search).get('fly') !== '1') return;
    deepLinked.current = true;
    takeControl();
  }, [support, takeControl]);

  /**
   * Leaving the world returns a deep-linked visitor to where they were.
   *
   * Someone who reached `/explore` themselves is *at* `/explore`, and dropping
   * them onto the page they chose is correct — Escape leaves fullscreen and
   * the canvas carries on inline. Someone who pressed `▸ Take control` at the
   * bottom of `/` never chose this page: they were reading the home sequence,
   * and to them `/explore` is the back of the room the door opened into.
   * Leaving the world should put them back where they were standing.
   *
   * `router.back()` rather than `push('/')` because only a history traversal
   * restores scroll — a push lands them at the top of the home page, a long
   * way above the portal they left from. The one case it cannot serve is a
   * `?fly=1` URL opened directly in a fresh tab, where there is nothing behind
   * this entry; that falls back to the home page.
   *
   * Keyed on `immersive` going false rather than on a click, because the
   * browser can leave without asking: Escape, F11 and the system chrome all
   * exit fullscreen on their own. See `useImmersive`.
   */
  const wasImmersive = useRef(false);
  useEffect(() => {
    if (immersive) {
      wasImmersive.current = true;
      return;
    }
    if (!wasImmersive.current) return;
    wasImmersive.current = false;
    if (!deepLinked.current) return;
    deepLinked.current = false;
    setFlying(false);
    if (window.history.length > 1) router.back();
    else router.push('/');
  }, [immersive, router]);

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
        className="glass p-6 text-sm"
        style={{
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
  const guiding = zones.find((zone) => zone.id === telemetry.guidingTo);

  return (
    /*
      The world breaks out of the page's max-w-3xl prose column. 94vw rather
      than 100vw deliberately: a full-viewport-width child inside a centred
      column overflows by exactly the scrollbar's width and gives the whole
      page a horizontal scrollbar.
    */
    /*
      The centring transform has to come off while the canvas is immersive.
      `position: fixed` resolves against the nearest transformed ancestor, not
      the viewport, so `-translate-x-1/2` silently turns a fixed frame into an
      absolutely-positioned box inside this 94vw column.
    */
    <div
      className={
        immersive
          ? ''
          : 'relative left-1/2 w-[min(94vw,1700px)] -translate-x-1/2'
      }
    >
      <div
        ref={frame}
        // Tall enough to fly in. min-h keeps it usable on a short laptop
        // window, where 80vh can be under 400px.
        className={
          immersive
            ? IMMERSIVE_FRAME
            : 'relative h-[80vh] max-h-[900px] min-h-[420px] w-full overflow-hidden rounded-lg border'
        }
        style={{
          borderColor: immersive ? 'transparent' : 'var(--border)',
          backgroundColor: immersive ? '#0b0e11' : 'var(--bg-subtle)',
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

        {/* Discovery counter, and the audio control under it. Top-left is the
            only corner occupied in every state — bottom-left carries telemetry
            in fullscreen and top-right carries the jump list — and §4.2 asks
            for one control that is ALWAYS visible, not one that appears with
            the mode that happens to have room for it. */}
        {/* z-10: above the "Take control" scrim, which is later in the DOM
            and otherwise covered this corner — the audio toggle, the one
            control §4.2 says is ALWAYS reachable, could not be clicked until
            the visitor had taken control (found on the live site, 2026-09-24). */}
        <div className="pointer-events-none absolute top-3 left-3 z-10">
          <p className="font-mono text-[11px]" style={{ color: '#7d8794' }}>
            {found} of {total} found
          </p>
          {guiding ? (
            // 9.2: say what is flying the craft, and how to take it back.
            // Live region, so a screen reader hears the flight start.
            <p
              className="mt-1 font-mono text-[11px]"
              style={{ color: '#3ddba0' }}
              aria-live="polite"
            >
              autopilot ▸ {guiding.label}
              <br />
              <span style={{ color: '#7d8794' }}>
                any flight control takes over
              </span>
            </p>
          ) : (
            nearest &&
            !activeId && (
              <p
                className="mt-1 font-mono text-[11px]"
                style={{ color: '#3ddba0' }}
              >
                {nearest.label} · {telemetry.nearestDistance.toFixed(0)} m
              </p>
            )
          )}
          <div className="pointer-events-auto mt-2">
            <AudioToggle />
          </div>
        </div>

        {/*
          The jump list follows the canvas into fullscreen. It is the
          accessible route to every marker, and leaving it behind on a page the
          visitor can no longer see would be a regression dressed as a feature.
          The copy below stays mounted but hidden, so focus never jumps.
        */}
        {immersive && (
          <div className="absolute top-3 right-3 flex max-w-[min(70vw,52rem)] flex-wrap justify-end gap-2">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() =>
                  setJump((previous) => ({
                    id: zone.id,
                    nonce: (previous?.nonce ?? 0) + 1,
                  }))
                }
                className={OVERLAY_BUTTON}
                style={overlayButtonStyle(discovered.has(zone.id))}
              >
                {zone.label}
              </button>
            ))}
            <button
              type="button"
              onClick={exit}
              className={OVERLAY_BUTTON}
              style={overlayButtonStyle()}
            >
              exit ✕
            </button>
          </div>
        )}

        {/* Instruments. */}
        {flying && !immersive && (
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
                className="glass glass-btn glass-press glass-accent glass-blur hud px-5 py-2.5 text-sm font-semibold"
              >
                Take control
              </button>
              <p className="mt-3 text-xs" style={{ color: '#9aa1ac' }}>
                {coarsePointer
                  ? 'Two thumb sticks appear — throttle and yaw on the left, pitch and roll on the right.'
                  : 'WASD to fly, arrow keys for altitude and yaw.'}
              </p>
            </div>
          </div>
        )}

        {flying && immersive && (
          <p
            className="pointer-events-none absolute bottom-4 left-4 font-mono text-[11px]"
            style={{ color: '#7d8794' }}
          >
            alt {telemetry.altitude.toFixed(1)} m · {telemetry.speed.toFixed(1)}{' '}
            m/s · hdg {telemetry.heading.toFixed(0).padStart(3, '0')}
            <br />
            {deepLinked.current ? 'esc to go back' : 'esc to leave fullscreen'}
          </p>
        )}

        {/* Keyboard legend, bottom right, for anyone flying with a mouse and
            keyboard — where the right thumb stick would otherwise sit. */}
        {flying && !coarsePointer && (
          <dl
            className="pointer-events-none absolute right-4 bottom-4 space-y-1 text-right"
            aria-label="Flight controls"
          >
            {KEY_LEGEND.map(([keys, action]) => (
              <div key={keys} className="flex items-baseline justify-end gap-3">
                <dd
                  className="font-mono text-[10px]"
                  style={{ color: '#5f6570' }}
                >
                  {action}
                </dd>
                <dt
                  className="font-mono text-[11px] tracking-wide"
                  style={{ color: '#7d8794' }}
                >
                  {keys}
                </dt>
              </div>
            ))}
          </dl>
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
      </div>

      {/*
        The jump list. Not a convenience — the point. Flying is a way to read
        this site, never a requirement, and nobody should have to be good at it
        to reach the contact details.
      */}
      <div className="mt-5" hidden={immersive}>
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
                  className="glass glass-btn glass-press px-2.5 py-1.5 font-mono text-[11px]"
                  style={{ color: seen ? 'var(--accent)' : 'var(--fg-muted)' }}
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
