import { makeSeededRandom } from '@/lib/random';

/**
 * Tier-A particle field — Phase 8.5, mood mapping completed 2026-09-03.
 *
 * A SERVER component: a fixed container of absolutely-positioned spans, each
 * carrying a CSS animation. No canvas, no client component, no `use client`,
 * and therefore **0 KB of JavaScript on every route**.
 *
 * It started as a canvas. Measured A/B on the same build, one client component
 * on one content route cost +2 KB on *every* route — `/lab` and the case
 * studies paying for a decoration they never render, because a client module
 * enters the shared graph. That is the wrong shape of cost for the least
 * important thing in the phase, so it was rebuilt in CSS.
 *
 * Positions come from the project's seeded RNG rather than `Math.random`, for
 * the reason `lib/random.ts` exists: a field that rearranged itself between
 * server and client render is a hydration mismatch, and one that rearranged
 * itself per visit is not a place.
 *
 * Motion, colour, the quickening on focus, and the reduced-motion branch all
 * live in `globals.css` under `.pfield`. This file only decides where the
 * marks are and how fast each one runs.
 */

/**
 * One mood per content route, per the table in `docs/DESIGN-LANGUAGE.md` §5.2.
 * The mood is telemetry about which page you are on, so no two of them may
 * look alike at a glance — colour AND pattern AND direction all differ.
 *
 *   standby — `/`         rising dust, `--fg-muted`
 *   calm    — `/about`    motes bobbing in place, `--fg-muted`, larger, soft
 *   index   — `/projects` ticks stepping down a lattice, `--accent`
 *   signal  — `/contact`  thin rising streaks in `--accent`
 *
 * `/projects/[slug]` deliberately has no mood: a case study is for reading.
 */
type Mood = 'standby' | 'calm' | 'index' | 'signal';

/*
 * Counts are per-rail — the component emits COUNT[mood] marks on the left and
 * the same number again on the right, so the two margins stay balanced no
 * matter what the RNG does. Previously a single loop picked a side per mark,
 * which at these counts routinely left one rail visibly emptier than the
 * other; at 14–16 total marks that read as a bug rather than as scatter.
 *
 * These roughly tripled on 2026-09-03. The old counts were tuned when the
 * field sat at 0.28 opacity and 2px — at that size it was invisible, so the
 * count was never really tested against a field you could actually see.
 */
const COUNT: Record<Mood, number> = {
  standby: 22,
  calm: 12, // fewer, larger, softer — the mood is a person, not a machine
  index: 20,
  signal: 18,
};

/**
 * Marks are placed as a fraction of `--pf-rail`, the custom property the
 * stylesheet derives from the actual free margin:
 *
 *   --pf-rail: calc((100vw - 48rem) / 2 - 20px)
 *
 * 48rem is the reading column (`max-w-3xl` on `<main>`), so this is literally
 * "the space left over beside the text, minus a 20px gap". Percentages were
 * the bug: an 11%-then-15% rail is fine at 1440px and sits ON the paragraph at
 * 1000px, because the margin shrinks with the viewport while a percentage of
 * the viewport grows into it. The guarantee that the field never touches the
 * reading column is now geometric rather than a number that happened to work
 * on the machine it was tuned on. `globals.css` also raises the enabling
 * breakpoint to 1200px, below which the margin is too thin to be worth it.
 *
 * Left-rail marks are positioned with `left`, right-rail marks with `right`,
 * each measured from its own edge — so the two rails mirror exactly and
 * neither depends on knowing the viewport width.
 */

/**
 * `index` lattice geometry. The cell is a SQUARE and the rail holds a whole
 * number of them: 4 columns of 44px = 176px, which fits inside `--pf-rail`
 * even at the 1200px breakpoint (196px there). Sizing the lattice as a
 * percentage produced non-square cells and a sliced column at the inner edge,
 * which is the one thing a grid must never have — a partial cell reads as a
 * clipping bug, not as a grid.
 */
const CELL = 44;
const COLS = 4;

export function ParticleField({ mood }: { mood: Mood }) {
  const SEED: Record<Mood, number> = {
    standby: 8501,
    signal: 8502,
    calm: 8503,
    index: 8504,
  };
  const rand = makeSeededRandom(SEED[mood]);

  const marks = [];
  for (let i = 0; i < COUNT[mood] * 2; i++) {
    // Even index = left rail, odd = right. Alternating rather than filling one
    // rail then the other keeps the two sides drawing from an interleaved
    // slice of the sequence, so they do not end up mirror images.
    const onLeft = i % 2 === 0;
    const across = rand();
    const delay = rand();
    const speed = rand();

    // Distance from this mark's OWN edge of the screen. `index` quantises it
    // to a lattice column centre; every other mood scatters freely across the
    // rail. Either way it is an offset from the outer edge, never a position
    // in the viewport, so the two rails are exact mirrors.
    const offset =
      mood === 'index'
        ? `${(Math.min(Math.floor(across * COLS), COLS - 1) + 0.5) * CELL - 2}px`
        : `calc(var(--pf-rail) * ${across.toFixed(4)})`;

    const style: React.CSSProperties & Record<string, string | undefined> = {
      [onLeft ? 'left' : 'right']: offset,
      // Negative delay starts each mark part-way through its cycle, so the
      // field is already populated on first paint instead of marching up the
      // screen together.
      animationDelay: `${(-delay * 30).toFixed(2)}s`,
      // The duration is a CUSTOM PROPERTY, not `animation-duration`. An inline
      // `animation-duration` cannot be overridden by any stylesheet rule,
      // which killed the quicken-on-focus effect outright. The stylesheet
      // multiplies this by an inherited `--pf-speed`, which a rule on the
      // container CAN set.
      '--pf-dur': `${DURATION[mood](speed)}s`,
    };

    if (mood === 'signal') {
      // Streak length varies per mark — that variance IS the pattern here.
      style.height = `${(22 + speed * 46).toFixed(0)}px`;
    }

    if (mood === 'calm') {
      // Breathing motes do not travel, so they need a resting position.
      // Spread over 90vh with a margin top and bottom.
      style.top = `${(5 + delay * 90).toFixed(2)}%`;
      style.bottom = 'auto';
      const size = 5 + speed * 7;
      style.width = `${size.toFixed(1)}px`;
      style.height = `${size.toFixed(1)}px`;
    }

    if (mood === 'index') {
      // Every tick starts half a cell above the first row and descends the
      // lattice one cell per step; the vertical spread comes from the negative
      // animation-delay, not from a per-mark `top`. Setting both would freeze
      // each tick in its own row, which is what made this mood read as static.
      // The -2px centres the 4px tick in its cell rather than sitting it on
      // the rule.
      style.top = `${CELL / 2 - 2}px`;
      style.bottom = 'auto';
    }

    marks.push(<span key={i} style={style} />);
  }

  return (
    <div className={`pfield pfield--${mood}`} aria-hidden="true">
      {marks}
    </div>
  );
}

/**
 * Cycle length per mood, as a function of the mark's own 0–1 roll. Kept beside
 * the counts because the two are read together when tuning: doubling the count
 * without lengthening the cycle turns drift into traffic.
 */
const DURATION: Record<Mood, (t: number) => string> = {
  standby: (t) => (24 + t * 20).toFixed(1),
  // A full bob out and back. Long, because the amplitude grew: 26px each way
  // over 7s is a twitch, over 16s it is breathing.
  calm: (t) => (13 + t * 9).toFixed(1),
  // 24 cells down the rail at ~0.75–1.1s per cell, which is a readout cadence
  // rather than a stutter. Tied to the step count in `pf-index`: change one
  // and the other stops meaning anything.
  index: (t) => (18 + t * 8).toFixed(1),
  signal: (t) => (8 + t * 8).toFixed(1),
};
