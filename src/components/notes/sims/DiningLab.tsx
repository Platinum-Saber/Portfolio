'use client';

import { useEffect, useRef, useState } from 'react';
import { rng } from './canvas';
import { Select, SimFrame, Slider } from './SimFrame';

/**
 * Five philosophers, five forks. A random scheduler runs one philosopher's next
 * action per tick. Naive: everyone takes LEFT then RIGHT - the circular wait can
 * close. Ordered: take the LOWER-numbered fork first (philosopher 4 reverses),
 * which breaks the cycle - the notes' fix.
 */

const N = 5;
type Phase = 'think' | 'first' | 'second' | 'eat';
type World = { phase: Phase[]; forks: (number | null)[]; meals: number[]; ticks: number; log: string[] };

const fresh = (): World => ({
  phase: Array(N).fill('think'),
  forks: Array(N).fill(null),
  meals: Array(N).fill(0),
  ticks: 0,
  log: [],
});

// Philosopher i sits between fork i (left) and fork (i+1)%N (right).
function forksOf(i: number, ordered: boolean): [number, number] {
  const l = i, r = (i + 1) % N;
  return ordered ? [Math.min(l, r), Math.max(l, r)] : [l, r];
}

function act(w: World, i: number, ordered: boolean): World {
  const x: World = { ...w, phase: [...w.phase], forks: [...w.forks], meals: [...w.meals], ticks: w.ticks + 1, log: [...w.log] };
  const [a, b] = forksOf(i, ordered);
  const say = (m: string) => x.log.push(`P${i}: ${m}`);
  switch (x.phase[i]) {
    case 'think':
      x.phase[i] = 'first';
      say('gets hungry');
      break;
    case 'first':
      if (x.forks[a] === null) { x.forks[a] = i; x.phase[i] = 'second'; say(`picks up fork ${a}`); }
      break;
    case 'second':
      if (x.forks[b] === null) { x.forks[b] = i; x.phase[i] = 'eat'; say(`picks up fork ${b} and eats`); }
      break;
    case 'eat':
      x.forks[a] = null; x.forks[b] = null; x.phase[i] = 'think'; x.meals[i]++;
      say('puts both forks down');
      break;
  }
  return x;
}

const deadlocked = (w: World) => w.phase.every((p) => p === 'second') && w.forks.every((f) => f !== null);

export function DiningLab() {
  const [ordered, setOrdered] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [running, setRunning] = useState(false);
  const [w, setW] = useState<World>(fresh);
  const r = useRef(rng(7));

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setW((cur) => {
        if (deadlocked(cur)) { setRunning(false); return cur; }
        // Pick a philosopher who can act; if nobody can, it is a deadlock.
        const able = [...Array(N).keys()].filter((i) => {
          const [a, b] = forksOf(i, ordered);
          const ph = cur.phase[i];
          return ph === 'think' || ph === 'eat' || (ph === 'first' && cur.forks[a] === null) || (ph === 'second' && cur.forks[b] === null);
        });
        if (able.length === 0) { setRunning(false); return cur; }
        // Bias towards grabbing forks, so the unlucky schedule shows up quickly.
        const grabbers = able.filter((i) => cur.phase[i] === 'first');
        const pool = grabbers.length && r.current.u() < 0.6 ? grabbers : able;
        return act(cur, pool[Math.floor(r.current.u() * pool.length)], ordered);
      });
    }, 1000 / speed);
    return () => clearInterval(t);
  }, [running, speed, ordered]);

  const dead = deadlocked(w);
  const cx = 150, cy = 130, R = 92;
  const pos = (k: number, rad: number) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * k) / N;
    return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)] as const;
  };
  const COLOR: Record<Phase, string> = { think: 'var(--nb-blue)', first: 'var(--nb-yellow)', second: 'var(--nb-orange)', eat: 'var(--nb-mint)' };

  return (
    <SimFrame
      title="Dining philosophers - watch the circular wait close"
      hint="Yellow: hungry, wants the first fork. Orange: holds one fork, wants the second. Green: eating. With the naive order the run eventually freezes with everyone holding their left fork. With the ordered rule it never can: philosopher 4 reaches for fork 0 first, so the cycle cannot close."
      controls={
        <>
          <Select
            label="Fork order"
            value={ordered ? 'ordered' : 'naive'}
            onChange={(v) => { setOrdered(v === 'ordered'); setW(fresh()); setRunning(false); }}
            options={[
              { value: 'naive', label: 'Naive: left, then right' },
              { value: 'ordered', label: 'Ordered: lower number first' },
            ]}
          />
          <Slider label="speed" value={speed} min={1} max={30} step={1} onChange={setSpeed} format={(v) => `${v}/s`} />
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm nb-btn-primary" onClick={() => setRunning(!running)} disabled={dead}>
              {running ? 'Pause' : 'Run'}
            </button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setW(fresh())}>
              Reset
            </button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          {w.ticks} actions · meals {w.meals.join(' / ')}
          {dead && <b> · DEADLOCK after {w.ticks} actions: every philosopher holds one fork and waits for the next</b>}
        </p>
      }
    >
      <div className="nb-dining">
        <svg viewBox="0 0 300 260" role="img" aria-label="Philosophers around the table">
          <circle cx={cx} cy={cy} r={58} fill="var(--nb-card)" stroke="var(--nb-ink)" strokeWidth={3} />
          {[...Array(N).keys()].map((k) => {
            // fork k lies between philosopher k-1 and k (it is P(k-1)'s right, Pk's left)
            const ang = -Math.PI / 2 + (2 * Math.PI * (k - 0.5)) / N;
            const p1 = [cx + 30 * Math.cos(ang), cy + 30 * Math.sin(ang)];
            const p2 = [cx + 56 * Math.cos(ang), cy + 56 * Math.sin(ang)];
            const holder = w.forks[k];
            const col = holder !== null ? 'var(--nb-red)' : 'var(--nb-ink)';
            const hp = holder !== null ? pos(holder, R - 22) : null;
            return (
              <g key={`f${k}`}>
                <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={col} strokeWidth={5} strokeLinecap="round" />
                {hp && <line x1={p2[0]} y1={p2[1]} x2={hp[0]} y2={hp[1]} stroke={col} strokeWidth={3} strokeDasharray="4 3" />}
                <text x={cx + 18 * Math.cos(ang)} y={cy + 18 * Math.sin(ang) + 4} textAnchor="middle" fontSize="10" fontFamily="ui-monospace" fill="var(--nb-ink)">{k}</text>
              </g>
            );
          })}
          {[...Array(N).keys()].map((k) => {
            const [x, y] = pos(k, R);
            return (
              <g key={`p${k}`}>
                <circle cx={x} cy={y} r={22} fill={COLOR[w.phase[k]]} stroke="var(--nb-ink)" strokeWidth={3} />
                <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#111">P{k}</text>
              </g>
            );
          })}
        </svg>
        <ol className="nb-race-log" aria-label="Event log">
          {w.log.slice(-9).map((l, k) => (
            <li key={k}>{l}</li>
          ))}
        </ol>
      </div>
    </SimFrame>
  );
}
