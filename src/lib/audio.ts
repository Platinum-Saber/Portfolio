'use client';

/**
 * The site's entire audio implementation — Phase 8.7.
 *
 * Web Audio API directly. No library (0 KB of dependency) and, more to the
 * point, **no audio file**: every voice is synthesised at runtime from
 * oscillators and a noise buffer. That decision does three things the plan
 * asked for at once. Nothing is fetched, so nothing can end up in the initial
 * payload and there is no lazy-loading problem to get wrong. There is no
 * licence to record next to a file, because there is no file — the hard gate in
 * DESIGN-LANGUAGE §4.8 is satisfied by having nothing to license. And the sound
 * is *generated from* the craft's speed rather than played alongside it, which
 * is the actual requirement in §4.5; a loop cannot reinforce motion, it can
 * only accompany it.
 *
 * Nothing here touches `window` at module scope, and no AudioContext exists
 * until `arm()` runs inside a user gesture. Importing this module is free.
 *
 * The rules it exists to enforce, all from DESIGN-LANGUAGE §4:
 *   - never autoplays; the context is constructed inside the unmute gesture
 *   - one master GainNode, ramped over 300–600 ms, never a hard cut
 *   - the choice persists in localStorage and is answered once
 *   - ducks and pauses on `visibilitychange` — required, not polish
 *   - `/explore`, `/explore/lab` and `/lab` only; content routes stay silent
 *
 * Three voices, all generated: an ambient bed that starts with the arming, an
 * engine driven by craft speed, and a tick on selection. §4.5 rules out "a bed
 * playing regardless of what the visitor is doing" — this one plays only for a
 * visitor who explicitly armed it, under an engine that is doing the reacting,
 * which is a different thing from a track that starts because a page loaded.
 */

export type AudioState = 'armed' | 'muted';

const STORAGE_KEY = 'audio';
const VOLUME_KEY = 'audio-volume';

/**
 * Default volume, as a plain gain multiplier on `MASTER`. 0.5 is half
 * amplitude — about -6 dB — which is where the first build should have
 * started: loud enough to hear on a laptop, quiet enough that nobody reaches
 * for the system volume. The measured levels in DESIGN-LANGUAGE §4.6 are the
 * ceiling, i.e. what you get with this at 1.
 */
const DEFAULT_VOLUME = 0.5;

/**
 * Master ceiling — the loudest the site will ever be, at volume 1. Every voice
 * below is written quiet on purpose: this is a portfolio, and the failure mode
 * that gets a tab closed is being loud, not being missed.
 */
const MASTER = 0.85;

/** Fade length for arm/disarm/duck. §4.6 asks for 300–600 ms and no hard cut. */
const RAMP = 0.4;

type Engine = {
  low: OscillatorNode;
  high: OscillatorNode;
  filter: BiquadFilterNode;
  tone: GainNode;
  air: GainNode;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engineVoice: Engine | null = null;
let padVoice: GainNode | null = null;
let lastTick = 0;
let armGesture: (() => void) | null = null;
/**
 * Set while the visitor is on a route with no audio (a content page). The
 * context is suspended but kept, the preference is untouched, and nothing —
 * not even a tab becoming visible again — may make a sound until a scene
 * un-parks it. See `park()`.
 */
let parked = false;
let parkTimer: number | null = null;

const listeners = new Set<(state: AudioState) => void>();

/* -------------------------------------------------------------------------
   Preference
   ------------------------------------------------------------------------- */

/**
 * The persisted preference — NOT whether sound is currently coming out. On a
 * fresh document load the preference can be `armed` while no context exists
 * yet, because no browser will let us build one before a gesture.
 * `resumeIfArmed` below closes that gap.
 */
export function readPreference(): AudioState {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'armed' ? 'armed' : 'muted';
  } catch {
    // Private mode or blocked storage. Muted is the safe default, and the
    // toggle still works for this page view.
    return 'muted';
  }
}

function writePreference(state: AudioState) {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // See above — a preference we cannot persist is not a reason to refuse
    // to make the sound the visitor just asked for.
  }
}

/**
 * Volume, 0–1, as a multiplier on `MASTER`. Read through a function rather
 * than cached in a module variable so a value written by another tab, or by a
 * toggle mounted on a different route, is always the one that applies.
 */
export function readVolume(): number {
  try {
    const raw = Number(localStorage.getItem(VOLUME_KEY));
    // `Number(null)` is 0, which is a legal volume — so the guard has to be on
    // the string being absent, not on the number being falsy. This is the same
    // trap the contact form's timing check fell into (see the 2026-08-22 entry
    // in PLAN.md): a real 0 and a missing value are different facts.
    if (localStorage.getItem(VOLUME_KEY) === null) return DEFAULT_VOLUME;
    return Number.isFinite(raw)
      ? Math.max(0, Math.min(1, raw))
      : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

/**
 * Sets volume and applies it immediately when sound is running. The ramp here
 * is 120 ms, not the 400 ms used for arm/disarm: dragging a slider is direct
 * manipulation, and anything longer than about a frame or two of lag reads as
 * the control being broken rather than as a graceful fade.
 */
export function setVolume(next: number): void {
  const clamped = Math.max(0, Math.min(1, next));
  try {
    localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    // Unpersisted, but still applied for this page view.
  }
  if (ctx && master && readPreference() === 'armed') {
    ramp(master.gain, MASTER * clamped, 0.12);
  }
}

/** Lets every mounted toggle agree, including across a client-side route change. */
export function subscribe(listener: (state: AudioState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announce(state: AudioState) {
  for (const listener of listeners) listener(state);
}

/* -------------------------------------------------------------------------
   Arming
   ------------------------------------------------------------------------- */

/**
 * Builds the context and master gain. MUST be called from inside a user
 * gesture handler — a context created outside one is born `suspended`, and
 * every subsequent `resume()` is a coin flip across browsers.
 */
export function arm(): void {
  cancelArmGesture();
  parked = false;
  // A park still fading out must not suspend the context we are reviving.
  if (parkTimer !== null) {
    window.clearTimeout(parkTimer);
    parkTimer = null;
  }

  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;

    // A limiter between the master and the speakers. Three voices can coincide
    // — pad, engine at full speed, and a tick landing on top — and measured
    // peaks at full speed already reach -1.7 dBFS before the tick is added.
    // One node, and it makes clipping structurally impossible rather than a
    // thing to keep re-measuring every time a level is tuned.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    master.connect(limiter);
    limiter.connect(ctx.destination);
    document.addEventListener('visibilitychange', onVisibility);
  }

  void ctx.resume();
  if (master) {
    ramp(master.gain, MASTER * readVolume());
    // The bed starts with the arming, not with the flying — it is the room
    // tone, and the engine plays over it.
    if (!padVoice) padVoice = buildPad(ctx, master);
    padVoice.gain.cancelScheduledValues(ctx.currentTime);
    padVoice.gain.setValueAtTime(padVoice.gain.value, ctx.currentTime);
    padVoice.gain.linearRampToValueAtTime(PAD_LEVEL, ctx.currentTime + 2.5);
  }
  writePreference('armed');
  announce('armed');
}

/**
 * Fades out and suspends. The context is kept rather than closed: re-arming is
 * then instant, and a closed context cannot be revived — it would have to be
 * rebuilt inside another gesture, which is a rule waiting to be broken.
 */
export function disarm(): void {
  cancelArmGesture();
  writePreference('muted');
  announce('muted');
  if (!ctx || !master) return;

  ramp(master.gain, 0);
  if (padVoice) ramp(padVoice.gain, 0);
  const dying = ctx;
  window.setTimeout(
    () => {
      // Only if the visitor has not re-armed in the meantime.
      if (readPreference() === 'muted') void dying.suspend();
    },
    RAMP * 1000 + 60,
  );
}

/** True only when sound is actually coming out, not merely remembered. */
function live(): boolean {
  return readPreference() === 'armed' && ctx !== null && ctx.state === 'running';
}

export function toggle(): AudioState {
  // A remembered 'armed' from an earlier visit is a PROMISE of sound, not
  // sound: no context can exist until this visit's first gesture. If that
  // gesture is a press on this very toggle, the visitor is asking to hear it,
  // so it arms — flipping the stored preference instead muted a site that had
  // never made a sound (found on the live site, 2026-09-24).
  if (!live()) {
    arm();
    return 'armed';
  }
  disarm();
  return 'muted';
}

/**
 * Honours a preference of `armed` carried in from a previous visit or another
 * route, without autoplaying: it waits for the visitor's next deliberate
 * gesture and arms inside that. On `/explore` that gesture is almost always
 * TAKE CONTROL, so the sound arrives exactly when the flying does.
 *
 * This is the one subtle reading of "never autoplays" in the spec. Silence
 * still holds for anyone who has never armed audio — the listener is not even
 * attached for them — and the rule it satisfies is the other half of §4.4:
 * the question is answered once, not on every route.
 *
 * Returns its own cleanup, so an unmounting component cannot leave a listener
 * behind that arms audio on a page which has no toggle.
 */
export function resumeIfArmed(): () => void {
  if (readPreference() !== 'armed') return () => {};

  // Coming back from a content page in the same visit: the context exists
  // (built inside an earlier gesture) and was parked on the way out. The page
  // already has sticky user activation, so resuming needs no new gesture.
  if (ctx) {
    arm();
    return () => {};
  }

  // Any gesture arms — except one aimed at the audio toggle itself, which
  // arms through its own click handler (`toggle`). Letting pointerdown arm
  // first meant the click that followed saw a live context and muted it.
  // Not `once`: an ignored toggle press must not use up the listener; `arm()`
  // removes it via cancelArmGesture.
  const onGesture = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest?.('[data-audio-toggle]')) return;
    arm();
  };
  armGesture = () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    armGesture = null;
  };
  window.addEventListener('pointerdown', onGesture);
  window.addEventListener('keydown', onGesture);

  return () => armGesture?.();
}

function cancelArmGesture() {
  armGesture?.();
}

/**
 * Leaving the audio routes. The site navigates client-side, so the module —
 * and its AudioContext — outlives the scene that armed it: without this the
 * ambient bed played on under `/` and the case studies, which §4.3 forbids
 * ("content routes stay silent"). Found on the live site, 2026-09-24.
 *
 * Fades everything out, then suspends. Unlike `disarm()` it does NOT touch
 * the preference: the visitor chose sound for the scenes, and gets it back
 * the moment they return to one (`resumeIfArmed`).
 *
 * Called by `AudioToggle` on unmount, because the toggle is mounted on
 * exactly the routes where audio is allowed — its lifetime IS the audio
 * scope, so no route list has to be kept in sync with it.
 */
export function park(): void {
  cancelArmGesture();
  if (!ctx || !master) return;
  parked = true;
  engineOff();
  ramp(master.gain, 0);
  if (padVoice) ramp(padVoice.gain, 0);
  const sleeping = ctx;
  if (parkTimer !== null) window.clearTimeout(parkTimer);
  parkTimer = window.setTimeout(() => {
    parkTimer = null;
    if (parked) void sleeping.suspend();
  }, RAMP * 1000 + 60);
}

/* -------------------------------------------------------------------------
   Visibility
   ------------------------------------------------------------------------- */

function onVisibility() {
  if (!ctx || !master) return;
  if (document.hidden) {
    ramp(master.gain, 0, 0.15);
    window.setTimeout(() => {
      if (document.hidden) void ctx?.suspend();
    }, 200);
  } else if (readPreference() === 'armed' && !parked) {
    void ctx.resume();
    ramp(master.gain, MASTER * readVolume());
  }
}

/* -------------------------------------------------------------------------
   Voices
   ------------------------------------------------------------------------- */

/**
 * Resting level of the ambient bed. Deliberately well under the engine: the
 * bed is the room, the engine is the thing you are doing in it, and if the
 * two are close the craft stops sounding like it is moving.
 */
const PAD_LEVEL = 0.16;

/**
 * The ambient bed — a slow, evolving drone rather than a loop.
 *
 * Six sine partials on a fifth (A2, E3, A3, plus a cent-detuned twin of each)
 * through a gentle lowpass. The twins are detuned by a few cents in opposite
 * directions, so they beat against each other at well under 1 Hz — that
 * beating is what makes it evolve without a sequencer, an envelope, or a file,
 * and it never repeats because the partials are not in integer ratios.
 *
 * A slow LFO on the filter cutoff gives it the swell. Total cost: nine nodes
 * and no bytes.
 *
 * A on purpose: the accent green is the site's one colour and A minor is close
 * enough to "cool and unresolved" to belong to it. It is also low enough not
 * to fight the engine's 120 Hz fundamental for the same band.
 */
function buildPad(context: AudioContext, out: GainNode): GainNode {
  const level = context.createGain();
  level.gain.value = 0;

  const soften = context.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 1200;
  soften.Q.value = 0.6;
  soften.connect(level);
  level.connect(out);

  // A3, E4, A4 — root, fifth, octave.
  //
  // An octave up from where this started, and the change is not taste. These
  // are SINE partials: a sine has no harmonics, so the fundamental is the only
  // thing there is to hear, and a laptop speaker reproduces almost nothing
  // below ~200 Hz. At A2/E3/A3 the entire pad sat under that wall — measured
  // at -34.9 dBFS overall and effectively nothing in the reproducible band, so
  // no amount of gain would have made it audible on the machine most visitors
  // are using. The engine escapes this because a sawtooth carries harmonics
  // well above its 120 Hz fundamental.
  for (const [hz, weight] of [
    [220, 1],
    [329.63, 0.55],
    [440, 0.4],
  ] as const) {
    for (const cents of [-6, 6]) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz;
      osc.detune.value = cents;
      const g = context.createGain();
      g.gain.value = 0.5 * weight;
      osc.connect(g);
      g.connect(soften);
      osc.start();
    }
  }

  // The swell. 0.04 Hz is a 25-second cycle — slow enough that it reads as
  // the sound breathing rather than as an effect being applied to it.
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.04;
  const depth = context.createGain();
  depth.gain.value = 400;
  lfo.connect(depth);
  depth.connect(soften.frequency);
  lfo.start();

  return level;
}

/**
 * The craft. Two saw oscillators a few cents apart (the beating between them
 * is what stops it sounding like a test tone) through a lowpass that opens
 * with speed, plus a band of filtered noise for air. Built on first use, which
 * is the first frame of flight with audio armed — never before.
 */
function buildEngine(context: AudioContext, out: GainNode): Engine {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  // 420 Hz, not 170. A 170 Hz lowpass on a 46 Hz saw puts essentially all of
  // the energy below what a laptop speaker can physically reproduce — measured
  // at -54 dBFS above 200 Hz while hovering, which is silence with extra steps.
  // See the 2026-09-03 retune entry in docs/PLAN.md.
  filter.frequency.value = 420;
  filter.Q.value = 4;

  const tone = context.createGain();
  tone.gain.value = 0;

  // 120 Hz fundamental. Low enough to read as a machine, high enough that its
  // harmonics land in the 240–600 Hz band every speaker can actually produce.
  const low = context.createOscillator();
  low.type = 'sawtooth';
  low.frequency.value = 120;

  const high = context.createOscillator();
  high.type = 'sawtooth';
  high.frequency.value = 120;
  high.detune.value = 11;

  low.connect(filter);
  high.connect(filter);
  filter.connect(tone);
  tone.connect(out);
  low.start();
  high.start();

  // Two seconds of white noise, looped. Cheaper and smaller than any file,
  // and the loop point is inaudible because noise has no phase to match.
  const frames = context.sampleRate * 2;
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 950;
  band.Q.value = 0.7;

  const air = context.createGain();
  air.gain.value = 0;

  noise.connect(band);
  band.connect(air);
  air.connect(out);
  noise.start();

  return { low, high, filter, tone, air };
}

/**
 * Drive the engine from normalised speed, 0–1. Each scene divides by its own
 * maximum before calling, so this never has to know how fast either craft is.
 *
 * Telemetry arrives at 5 Hz, so every parameter moves with `setTargetAtTime`
 * rather than being assigned: the 120 ms time constant covers the gap between
 * updates, and the result is a continuous glide instead of a staircase.
 */
export function engine(level: number): void {
  if (!ctx || !master || readPreference() !== 'armed') return;
  if (!engineVoice) engineVoice = buildEngine(ctx, master);

  const t = Math.max(0, Math.min(1, level));
  const now = ctx.currentTime;
  const glide = 0.12;

  engineVoice.filter.frequency.setTargetAtTime(420 + t * 1500, now, glide);
  engineVoice.low.frequency.setTargetAtTime(120 + t * 46, now, glide);
  engineVoice.high.frequency.setTargetAtTime(120 + t * 46, now, glide);
  engineVoice.tone.gain.setTargetAtTime(0.1 + t * 0.2, now, glide);
  // Air scales with the square of speed, because it should be inaudible while
  // hovering and clearly there at a sprint rather than present throughout.
  engineVoice.air.gain.setTargetAtTime(t * t * 0.16, now, glide);
}

/** Fades the craft out without tearing it down — used when flight stops. */
export function engineOff(): void {
  if (!ctx || !engineVoice) return;
  const now = ctx.currentTime;
  engineVoice.tone.gain.setTargetAtTime(0, now, 0.25);
  engineVoice.air.gain.setTargetAtTime(0, now, 0.25);
}

/**
 * A soft tick, for a hotspot taking focus. Short enough to read as a UI
 * confirmation rather than a note, and rate-limited: arrowing down a list of
 * hotspots should sound like an instrument, not a Geiger counter.
 */
export function tick(): void {
  if (!ctx || !master || readPreference() !== 'armed') return;
  const now = ctx.currentTime;
  if (now - lastTick < 0.06) return;
  lastTick = now;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1180;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(0.07, now + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.connect(env);
  env.connect(master);
  osc.start(now);
  osc.stop(now + 0.2);
  // Let the graph collect itself rather than holding a reference.
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

/* -------------------------------------------------------------------------
   Helper
   ------------------------------------------------------------------------- */

function ramp(param: AudioParam, to: number, seconds = RAMP) {
  if (!ctx) return;
  const now = ctx.currentTime;
  // Pin the current value first: without this, a ramp started while another is
  // still running jumps to wherever the old one was scheduled to be.
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + seconds);
}
