'use client';

import { useEffect, useState } from 'react';
import { OVERLAY_BUTTON, overlayButtonStyle } from './explore/useImmersive';
import {
  type AudioState,
  readPreference,
  readVolume,
  resumeIfArmed,
  setVolume,
  subscribe,
  toggle,
} from '@/lib/audio';

/**
 * `AUDIO ▸ ARMED / MUTED` — the one audio control, per DESIGN-LANGUAGE §4.2.
 * Console language rather than museum language, always visible, keyboard
 * reachable, `aria-pressed` carrying the state to a screen reader.
 *
 * It renders in the overlay chrome of the three 3D routes and nowhere else.
 * Content routes have no toggle because they have no sound.
 *
 * Why it starts at `muted` and corrects on mount: the preference lives in
 * `localStorage`, which the server cannot read, so rendering the stored value
 * directly would be a hydration mismatch. Unlike the theme toggle — which
 * dodges this by keeping its state in a DOM attribute an inline script sets
 * before paint — audio cannot be resolved before paint, because there is
 * nothing to resolve until a gesture happens. Muted-then-correct is right in a
 * way it would not be for theme: the wrong state for one frame is invisible,
 * and it fails to the silent side.
 */
/**
 * `overlay` sits on a dark canvas and uses the fixed overlay palette the rest
 * of the flight chrome uses; `inline` sits on the page and uses the theme
 * tokens, because `/lab` has no canvas overlay to live in and a hardcoded dark
 * pill on a light page reads as a leftover, not as chrome.
 */
export function AudioToggle({
  variant = 'overlay',
}: {
  variant?: 'overlay' | 'inline';
}) {
  const [state, setState] = useState<AudioState>('muted');
  // Mirrors the same reasoning as `state`: the stored value is unreadable on
  // the server, so render the default and correct on mount.
  const [level, setLevel] = useState(0.5);

  useEffect(() => {
    setState(readPreference());
    setLevel(readVolume());
    const unsubscribe = subscribe(setState);
    // Carries an `armed` preference in from a previous visit or route without
    // autoplaying — it waits for the next gesture. No-op when muted.
    const cancel = resumeIfArmed();
    return () => {
      unsubscribe();
      cancel();
    };
  }, []);

  const armed = state === 'armed';
  const overlay = variant === 'overlay';

  function onVolume(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value);
    setLevel(next);
    setVolume(next);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        // `toggle()` runs synchronously inside this handler, which is what makes
        // the AudioContext legal to construct. Anything async between the click
        // and the context — an await, a transition, a timeout — and the browser
        // stops counting it as a user gesture.
        onClick={() => setState(toggle())}
        data-audio-toggle
        aria-pressed={armed}
        aria-label={armed ? 'Mute audio' : 'Enable audio'}
        title={armed ? 'Mute audio' : 'Enable audio'}
        className={
          variant === 'overlay'
            ? OVERLAY_BUTTON
            : 'glass glass-btn glass-press px-2.5 py-1 font-mono text-[11px]'
        }
        style={
          variant === 'overlay'
            ? overlayButtonStyle(armed)
            : { color: armed ? 'var(--accent)' : 'var(--fg-muted)' }
        }
      >
        audio ▸ {armed ? 'armed' : 'muted'}
      </button>

      {/* Only while armed. A volume control on a muted site is a control for
        nothing, and it would be the second thing competing for the corner
        §4.2 reserves for one always-visible toggle. */}
      {armed && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={level}
          onChange={onVolume}
          aria-label="Audio volume"
          title={`Volume ${Math.round(level * 100)}%`}
          className="pf-volume h-1 w-20 cursor-pointer appearance-none rounded-full"
          style={
            {
              // The filled portion is drawn with a gradient rather than a second
              // element, so the whole control is one native input — which is
              // what keeps it keyboard-operable (arrows, Home/End) for free.
              '--pf-vol': `${level * 100}%`,
              backgroundColor: overlay
                ? 'rgba(125,135,148,0.45)'
                : 'var(--border)',
              backgroundImage: `linear-gradient(to right, ${
                overlay ? '#3ddba0' : 'var(--accent)'
              } var(--pf-vol), transparent var(--pf-vol))`,
            } as React.CSSProperties
          }
        />
      )}
    </div>
  );
}
