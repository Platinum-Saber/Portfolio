'use client';

import { useState } from 'react';
import { Select, SimFrame } from './SimFrame';

/**
 * Two threads run `counter++` K times each. Step them one machine instruction
 * at a time and watch an update get lost - then add the mutex.
 */

type Thread = { pc: number; reg: number; iter: number };
type World = { counter: number; lockedBy: number | null; t: [Thread, Thread]; log: string[] };

const PLAIN = ['LOAD  r, counter', 'ADD   r, r, 1', 'STORE counter, r'];
const LOCKED = ['LOCK  m', 'LOAD  r, counter', 'ADD   r, r, 1', 'STORE counter, r', 'UNLOCK m'];

function fresh(): World {
  return { counter: 0, lockedBy: null, t: [{ pc: 0, reg: 0, iter: 0 }, { pc: 0, reg: 0, iter: 0 }], log: [] };
}

function step(w: World, id: 0 | 1, K: number, mutex: boolean): World {
  const prog = mutex ? LOCKED : PLAIN;
  const me = w.t[id];
  if (me.iter >= K) return w;
  const op = prog[me.pc];
  const next: World = { ...w, t: [{ ...w.t[0] }, { ...w.t[1] }] as [Thread, Thread], log: [...w.log] };
  const t = next.t[id];
  const name = `T${id + 1}`;
  if (op.startsWith('LOCK')) {
    if (next.lockedBy !== null && next.lockedBy !== id) {
      next.log.push(`${name}: LOCK blocks - T${next.lockedBy + 1} holds m`);
      return next;
    }
    next.lockedBy = id;
    next.log.push(`${name}: LOCK m acquired`);
  } else if (op.startsWith('LOAD')) {
    t.reg = next.counter;
    next.log.push(`${name}: r = counter (${t.reg})`);
  } else if (op.startsWith('ADD')) {
    t.reg += 1;
    next.log.push(`${name}: r = r + 1 (${t.reg})`);
  } else if (op.startsWith('STORE')) {
    const lost = next.counter >= t.reg;
    next.counter = t.reg;
    next.log.push(`${name}: counter = r (${t.reg})${lost ? '  ← overwrote the other thread: LOST UPDATE' : ''}`);
  } else if (op.startsWith('UNLOCK')) {
    next.lockedBy = null;
    next.log.push(`${name}: UNLOCK m`);
  }
  t.pc += 1;
  if (t.pc === prog.length) {
    t.pc = 0;
    t.iter += 1;
  }
  return next;
}

export function RaceLab() {
  const [K, setK] = useState(2);
  const [mutex, setMutex] = useState(false);
  const [w, setW] = useState<World>(fresh);
  const prog = mutex ? LOCKED : PLAIN;
  const done = w.t.every((t) => t.iter >= K);
  const blocked = (id: 0 | 1) =>
    mutex && prog[w.t[id].pc].startsWith('LOCK') && w.lockedBy !== null && w.lockedBy !== id;

  const reset = (m = mutex, k = K) => {
    setMutex(m);
    setK(k);
    setW(fresh());
  };
  const runRandom = () => {
    let x = fresh();
    for (let guard = 0; guard < 500 && !x.t.every((t) => t.iter >= K); guard++) {
      const id = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
      x = step(x, x.t[id].iter >= K ? ((1 - id) as 0 | 1) : id, K, mutex);
    }
    setW(x);
  };
  const runWorst = () => {
    // T1 loads, T2 runs a whole increment, T1 stores: the classic lost update.
    let x = fresh();
    const order: (0 | 1)[] = mutex ? [0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1] : [0, 1, 1, 1, 0, 0];
    for (const id of order) x = step(x, id, K, mutex);
    setW(x);
  };

  return (
    <SimFrame
      title="Race on counter++ - step the interleaving"
      hint="counter++ is three instructions. Load in T1, run a whole increment in T2, then let T1 add and store: T2's update vanishes. Turn the mutex on and try again - the worst schedule can no longer interleave the critical section."
      controls={
        <>
          <Select
            label="Increments per thread"
            value={String(K)}
            onChange={(v) => reset(mutex, Number(v))}
            options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
          />
          <label className="nb-check">
            <input type="checkbox" checked={mutex} onChange={(e) => reset(e.target.checked, K)} />
            Protect with a mutex
          </label>
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setW(step(w, 0, K, mutex))} disabled={w.t[0].iter >= K}>
              Step T1
            </button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setW(step(w, 1, K, mutex))} disabled={w.t[1].iter >= K}>
              Step T2
            </button>
            <button type="button" className="nb-btn nb-btn-sm nb-btn-primary" onClick={runWorst}>
              Show a bad interleaving
            </button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={runRandom}>
              Random run
            </button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => reset()}>
              Reset
            </button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          counter = <b>{w.counter}</b> · expected after both finish = {2 * K}
          {done && (w.counter === 2 * K ? ' · correct' : <b> · {2 * K - w.counter} update(s) LOST</b>)}
        </p>
      }
    >
      <div className="nb-race">
        {([0, 1] as const).map((id) => (
          <div key={id} className="nb-race-thread" data-blocked={blocked(id) || undefined}>
            <p className="nb-eyebrow">
              Thread T{id + 1} · iteration {Math.min(w.t[id].iter + 1, K)}/{K} · r = {w.t[id].reg}
              {w.t[id].iter >= K && ' · done'}
              {blocked(id) && ' · BLOCKED'}
            </p>
            <ol>
              {prog.map((line, i) => (
                <li key={line} data-pc={w.t[id].pc === i && w.t[id].iter < K ? '' : undefined}>
                  <code>{line}</code>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <div className="nb-race-mem">
          <p className="nb-eyebrow">Shared memory</p>
          <p className="nb-race-counter">counter = {w.counter}</p>
          {mutex && <p className="nb-race-lock">m: {w.lockedBy === null ? 'free' : `held by T${w.lockedBy + 1}`}</p>}
        </div>
        <ol className="nb-race-log" aria-label="Event log">
          {w.log.slice(-8).map((l, i) => (
            <li key={i} data-bad={l.includes('LOST') || undefined}>
              {l}
            </li>
          ))}
        </ol>
      </div>
    </SimFrame>
  );
}
