'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { DRONE_COMPONENTS, STATUS_LABEL, getComponent } from '@/lib/drone';
import { AudioToggle } from '../AudioToggle';
import { tick } from '@/lib/audio';

/**
 * The canvas and everything three.js loads only after this component mounts and
 * only if the browser can actually render it. Nothing about the surrounding page
 * waits on it — the full component reference is static HTML further down /lab.
 */
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
        Loading airframe…
      </p>
    </div>
  ),
});

type Support = 'checking' | 'ok' | 'unsupported';

let cachedSupport: Support | null = null;

/** Probed once per page load; the result can't change, so it's cached. */
function readSupport(): Support {
  if (cachedSupport) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    const ok = Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
    cachedSupport = ok ? 'ok' : 'unsupported';
  } catch {
    cachedSupport = 'unsupported';
  }
  return cachedSupport;
}

const NEVER_CHANGES = () => () => {};
const SERVER_SNAPSHOT = (): Support => 'checking';

export function AirframeExplorer() {
  // WebGL support is external, immutable state — reading it through
  // useSyncExternalStore avoids a setState-on-mount render cascade.
  const support = useSyncExternalStore(
    NEVER_CHANGES,
    readSupport,
    SERVER_SNAPSHOT,
  );
  const [selected, setSelected] = useState<string | null>(null);

  const component = selected ? getComponent(selected) : undefined;

  // A soft tick when a component is selected — §4.5's "sound reinforces
  // motion" for a scene whose only motion is attention moving between parts.
  // Selection rather than DOM focus on purpose: tabbing across eight markers
  // to reach the one you want would fire eight ticks, which is the Geiger
  // counter the rate limiter in `lib/audio` exists to prevent rather than to
  // excuse. Every path in — marker click, list button, Enter on a focused
  // marker — goes through `setSelected`, so this covers the keyboard too.
  //
  // Above the early return below, not after it: a hook under a conditional
  // return runs on the server's 'checking' render and not on the client's
  // 'unsupported' one, and React throws #300 (fewer hooks) — which blanked
  // /lab for every visitor without WebGL. Found by the 8.8 guardrail run.
  useEffect(() => {
    if (selected) tick();
  }, [selected]);

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
          The 3D view needs WebGL, which this browser has turned off.
        </p>
        <p className="mt-2">
          Nothing is lost — every component in the model is documented in full
          below.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* `/lab` has no canvas overlay, so the audio control gets a chrome row
          of its own above the scene. Still always visible, still one control. */}
      <div className="mb-3 flex justify-end">
        <AudioToggle variant="inline" />
      </div>

      {support === 'checking' ? (
        <div
          className="aspect-[4/3] w-full rounded-lg border sm:aspect-[16/10]"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        />
      ) : (
        <Scene
          selected={selected}
          onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
        />
      )}

      {/* Selection panel. Lives outside the canvas so the text stays real,
          selectable, and readable by a screen reader. */}
      <div
        className="mt-4 rounded-lg border p-5"
        style={{ borderColor: 'var(--border)' }}
        aria-live="polite"
      >
        {component ? (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-semibold">{component.name}</h3>
              <span
                className="font-mono text-xs"
                style={{ color: 'var(--accent)' }}
              >
                {component.category}
              </span>
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[11px]"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--fg-muted)',
                }}
              >
                {STATUS_LABEL[component.status]}
              </span>
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {component.specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex justify-between gap-4 text-sm"
                >
                  <dt style={{ color: 'var(--fg-muted)' }}>{spec.label}</dt>
                  <dd className="text-right font-mono text-xs">{spec.value}</dd>
                </div>
              ))}
            </dl>

            <p
              className="mt-4 text-sm leading-relaxed"
              style={{ color: 'var(--fg-muted)' }}
            >
              {component.statusNote}
            </p>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-4 font-mono text-xs hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              ← clear selection
            </button>
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            <p>Select a numbered marker to inspect a component.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {DRONE_COMPONENTS.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className="rounded border px-2 py-1 font-mono text-[11px] transition-colors"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--fg-muted)',
                    }}
                  >
                    {i + 1} · {c.short}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
