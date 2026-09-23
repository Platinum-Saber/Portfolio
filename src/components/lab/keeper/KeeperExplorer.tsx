'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { KeeperSim } from '@/lib/keeper/sim';
import { ESTIMATORS, type Controls, type Readouts } from './types';

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
        Loading pitch…
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
  phase: 'ready',
  sightings: 0,
  ekfError: null,
  lineError: null,
  outcome: null,
  shots: 0,
  saves: 0,
  reactionTime: null,
};

const INITIAL: Controls = {
  aimX: 0.75,
  aimY: 0.55,
  speed: 11,
  noise: 0.04,
  farGate: 4.5,
  nearGate: 2.6,
  estimator: 'ekf',
};

const cm = (metres: number | null) =>
  metres === null || Number.isNaN(metres)
    ? '—'
    : `${(metres * 100).toFixed(0)} cm`;

/** A labelled range input. Ranges are the one control a keyboard user gets for free. */
function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span
          className="font-mono text-[11px] tracking-wide uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          {label}
        </span>
        <span className="font-mono text-[11px]" style={{ color: 'var(--fg)' }}>
          {display}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full"
        style={{ accentColor: 'var(--accent)' }}
      />
    </label>
  );
}

export function KeeperExplorer() {
  const support = useSyncExternalStore(
    NEVER_CHANGES,
    readSupport,
    SERVER_SNAPSHOT,
  );

  const [controls, setControls] = useState<Controls>(INITIAL);
  const [shotToken, setShotToken] = useState(0);
  const [readouts, setReadouts] = useState<Readouts>(EMPTY);
  const simRef = useRef<KeeperSim | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(el);

    const onVisibilityChange = () => {
      if (document.hidden) setVisible(false);
      else setVisible(el.getBoundingClientRect().bottom > 0);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [support]);

  const onReadouts = useCallback((next: Readouts) => setReadouts(next), []);
  const set = <K extends keyof Controls>(key: K, value: Controls[K]) =>
    setControls((prev) => ({ ...prev, [key]: value }));

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
          The pitch needs WebGL, which this browser has turned off.
        </p>
        <p className="mt-2">
          The write-up below explains what the keeper has to work out, and why
          two sightings and a straight line are not enough — which is the part
          worth reading anyway.
        </p>
      </div>
    );
  }

  const active = ESTIMATORS.find((e) => e.id === controls.estimator);
  const outcome = readouts.outcome;

  const verdict = !outcome
    ? readouts.sightings === 0
      ? 'Waiting for the ball to reach the far gate.'
      : readouts.sightings === 1
        ? 'One sighting. Nothing can be predicted from a single point.'
        : 'Two sightings — prediction made, servo moving.'
    : outcome.reason === 'saved'
      ? 'Saved.'
      : outcome.reason === 'off-target'
        ? 'Wide of the goal — nothing to save.'
        : outcome.reason === 'too-slow'
          ? 'Goal. The prediction arrived too late for the servo to get there.'
          : 'Goal. The keeper went where it was told; the prediction was wrong.';

  return (
    <div>
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
          ref={wrapper}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border sm:aspect-[16/10]"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <Scene
            controls={controls}
            shotToken={shotToken}
            onReadouts={onReadouts}
            simRef={simRef}
            reducedMotion={reducedMotion}
            animating={visible}
          />
          <p
            className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px]"
            style={{ color: '#7d8794' }}
          >
            drag to orbit · scroll to zoom
          </p>
        </div>
      )}

      {/* Take the shot. The primary action, so it leads. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShotToken((n) => n + 1)}
          className="rounded border px-3 py-1.5 font-mono text-[11px] transition-colors"
          style={{
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            backgroundColor: 'var(--accent-soft)',
          }}
        >
          ▸ take the shot
        </button>
        <button
          type="button"
          onClick={() => {
            setControls((prev) => ({
              ...prev,
              aimX: Number((Math.random() * 2.2 - 1.1).toFixed(2)),
              aimY: Number((0.2 + Math.random() * 1.4).toFixed(2)),
              speed: Number((8 + Math.random() * 8).toFixed(1)),
            }));
            setShotToken((n) => n + 1);
          }}
          className="rounded border px-3 py-1.5 font-mono text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
        >
          random shot
        </button>
        <button
          type="button"
          onClick={() => {
            simRef.current?.reset();
            setReadouts(EMPTY);
          }}
          className="rounded border px-3 py-1.5 font-mono text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
        >
          reset tally
        </button>

        <span
          className="ml-auto font-mono text-[11px]"
          style={{
            color: outcome?.saved ? 'var(--accent)' : 'var(--fg-muted)',
          }}
          aria-live="polite"
        >
          {verdict}
        </span>
      </div>

      {/* Which prediction the servo obeys. */}
      <div className="mt-5 flex flex-wrap gap-2">
        <span
          className="self-center font-mono text-[11px] tracking-wide uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Keeper obeys
        </span>
        {ESTIMATORS.map((option) => {
          const selected = option.id === controls.estimator;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => set('estimator', option.id)}
              aria-pressed={selected}
              className="rounded border px-3 py-1.5 font-mono text-[11px] transition-colors"
              style={{
                borderColor: selected ? 'var(--accent)' : 'var(--border)',
                color: selected ? 'var(--accent)' : 'var(--fg-muted)',
                backgroundColor: selected
                  ? 'var(--accent-soft)'
                  : 'transparent',
              }}
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
          {active.blurb} Both predictions are drawn either way — green is the
          filter, amber the straight line.
        </p>
      )}

      {/* The shot, and the conditions the keeper has to work under. */}
      <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider
          label="Aim — across"
          value={controls.aimX}
          display={`${controls.aimX > 0 ? '+' : ''}${controls.aimX.toFixed(2)} m`}
          min={-1.4}
          max={1.4}
          step={0.05}
          onChange={(v) => set('aimX', v)}
        />
        <Slider
          label="Aim — height"
          value={controls.aimY}
          display={`${controls.aimY.toFixed(2)} m`}
          min={0.1}
          max={1.5}
          step={0.05}
          onChange={(v) => set('aimY', v)}
        />
        <Slider
          label="Shot speed"
          value={controls.speed}
          display={`${controls.speed.toFixed(1)} m/s`}
          min={6}
          max={18}
          step={0.5}
          onChange={(v) => set('speed', v)}
        />
        <Slider
          label="Camera noise (σ)"
          value={controls.noise}
          display={`${(controls.noise * 100).toFixed(0)} cm`}
          min={0}
          max={0.15}
          step={0.005}
          onChange={(v) => set('noise', v)}
        />
        <Slider
          label="Far gate"
          value={controls.farGate}
          display={`${controls.farGate.toFixed(1)} m`}
          min={3}
          max={6}
          step={0.1}
          onChange={(v) =>
            setControls((prev) => ({
              ...prev,
              farGate: Math.max(v, prev.nearGate + 0.3),
            }))
          }
        />
        <Slider
          label="Near gate"
          value={controls.nearGate}
          display={`${controls.nearGate.toFixed(1)} m`}
          min={1}
          max={5}
          step={0.1}
          onChange={(v) =>
            setControls((prev) => ({
              ...prev,
              nearGate: Math.min(v, prev.farGate - 0.3),
            }))
          }
        />
      </div>

      {/* The numbers the page exists for. */}
      <dl className="mt-7 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {[
          {
            label: 'EKF error at the goal',
            value: cm(readouts.ekfError),
          },
          {
            label: 'Straight-line error',
            value: cm(readouts.lineError),
          },
          {
            label: 'Reaction time after the near gate',
            value:
              readouts.reactionTime === null
                ? '—'
                : `${(readouts.reactionTime * 1000).toFixed(0)} ms`,
          },
          {
            label: 'Saves',
            value: `${readouts.saves} / ${readouts.shots}`,
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
