'use client';

import { useState } from 'react';
import { Select, SimFrame } from './SimFrame';

/**
 * Two processes, three entry protocols. Step each process one statement at a
 * time; the lab flags a mutual-exclusion violation or a state where both spin
 * forever. "Show the failure" plays the schedule that breaks each attempt.
 */

type Algo = 'att2' | 'att3' | 'peterson';
type Vars = { flag: [boolean, boolean]; victim: number };
type Proc = { pc: number; entries: number };
type World = { v: Vars; p: [Proc, Proc]; log: string[] };

type Line = { text: (i: number) => string; kind: 'set' | 'wait' | 'cs'; run?: (v: Vars, i: number) => Vars; blocked?: (v: Vars, i: number) => boolean };

const j = (i: number) => 1 - i;
const PROGS: Record<Algo, Line[]> = {
  att2: [
    { text: (i) => `while (flag[${j(i)}]) ;   // test the other's flag...`, kind: 'wait', blocked: (v, i) => v.flag[j(i)] },
    { text: (i) => `flag[${i}] = true;      // ...THEN set mine`, kind: 'set', run: (v, i) => setFlag(v, i, true) },
    { text: () => `critical section`, kind: 'cs' },
    { text: (i) => `flag[${i}] = false;`, kind: 'set', run: (v, i) => setFlag(v, i, false) },
  ],
  att3: [
    { text: (i) => `flag[${i}] = true;      // set mine first...`, kind: 'set', run: (v, i) => setFlag(v, i, true) },
    { text: (i) => `while (flag[${j(i)}]) ;   // ...then wait for the other`, kind: 'wait', blocked: (v, i) => v.flag[j(i)] },
    { text: () => `critical section`, kind: 'cs' },
    { text: (i) => `flag[${i}] = false;`, kind: 'set', run: (v, i) => setFlag(v, i, false) },
  ],
  peterson: [
    { text: (i) => `flag[${i}] = true;      // I am interested`, kind: 'set', run: (v, i) => setFlag(v, i, true) },
    { text: (i) => `victim = ${i};           // ...and I go second`, kind: 'set', run: (v, i) => ({ ...v, victim: i }) },
    {
      text: (i) => `while (flag[${j(i)}] && victim == ${i}) ;`,
      kind: 'wait',
      blocked: (v, i) => v.flag[j(i)] && v.victim === i,
    },
    { text: () => `critical section`, kind: 'cs' },
    { text: (i) => `flag[${i}] = false;`, kind: 'set', run: (v, i) => setFlag(v, i, false) },
  ],
};
function setFlag(v: Vars, i: number, b: boolean): Vars {
  const flag = [...v.flag] as [boolean, boolean];
  flag[i] = b;
  return { ...v, flag };
}

const FAILURE: Record<Algo, (0 | 1)[]> = {
  att2: [0, 1, 0, 1], // both test (flag is false), both set, both enter
  att3: [0, 1, 0, 1, 0, 1], // both set, both wait on each other forever
  peterson: [0, 1, 0, 1, 1, 0, 0, 1, 1], // tries the same trick: cannot break it
};

function fresh(): World {
  return { v: { flag: [false, false], victim: 0 }, p: [{ pc: 0, entries: 0 }, { pc: 0, entries: 0 }], log: [] };
}

function step(w: World, i: 0 | 1, algo: Algo): World {
  const prog = PROGS[algo];
  const line = prog[w.p[i].pc];
  const p = [{ ...w.p[0] }, { ...w.p[1] }] as [Proc, Proc];
  const log = [...w.log];
  let v = w.v;
  if (line.kind === 'wait' && line.blocked!(v, i)) {
    log.push(`P${i}: spins at "${line.text(i).split('//')[0].trim()}"`);
    return { v, p, log };
  }
  if (line.run) v = line.run(v, i);
  if (line.kind === 'cs') {
    p[i].entries += 1;
    log.push(`P${i}: leaves the critical section`);
  } else log.push(`P${i}: ${line.text(i).split('//')[0].trim()}`);
  p[i].pc = (p[i].pc + 1) % prog.length;
  return { v, p, log };
}

export function MutexLab() {
  const [algo, setAlgo] = useState<Algo>('att2');
  const [w, setW] = useState<World>(fresh);
  const prog = PROGS[algo];
  const csIndex = prog.findIndex((l) => l.kind === 'cs');
  const inCS = w.p.filter((p) => p.pc === csIndex).length;
  const bothStuck = w.p.every((p, i) => prog[p.pc].kind === 'wait' && prog[p.pc].blocked!(w.v, i));

  const showFailure = () => {
    let x = fresh();
    for (const i of FAILURE[algo]) x = step(x, i, algo);
    setW(x);
  };

  return (
    <SimFrame
      title="Mutual exclusion attempts - find the bad interleaving"
      hint="Each Step runs one statement. Attempt 2 tests before it sets, so both can slip past the test. Attempt 3 sets first, so both can wait on each other forever. Peterson adds victim: whoever wrote it last waits, so exactly one enters."
      controls={
        <>
          <Select
            label="Protocol"
            value={algo}
            onChange={(a) => {
              setAlgo(a);
              setW(fresh());
            }}
            options={[
              { value: 'att2', label: 'Attempt 2: test, then set own flag' },
              { value: 'att3', label: 'Attempt 3: set own flag, then test' },
              { value: 'peterson', label: "Peterson's algorithm" },
            ]}
          />
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setW(step(w, 0, algo))}>
              Step P0
            </button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setW(step(w, 1, algo))}>
              Step P1
            </button>
            <button type="button" className="nb-btn nb-btn-sm nb-btn-primary" onClick={showFailure}>
              Show the failure
            </button>
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => setW(fresh())}>
              Reset
            </button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          flag = [{String(w.v.flag[0])}, {String(w.v.flag[1])}]{algo === 'peterson' && ` · victim = ${w.v.victim}`} ·
          entries P0 {w.p[0].entries}, P1 {w.p[1].entries}
          {inCS === 2 && <b> · MUTUAL EXCLUSION VIOLATED: both in the critical section</b>}
          {bothStuck && <b> · DEADLOCK: both spin and neither can ever pass</b>}
          {algo === 'peterson' && inCS < 2 && !bothStuck && w.log.length > 6 && ' · still safe'}
        </p>
      }
    >
      <div className="nb-race">
        {([0, 1] as const).map((i) => (
          <div key={i} className="nb-race-thread">
            <p className="nb-eyebrow">Process P{i}</p>
            <ol>
              {prog.map((l, k) => (
                <li key={k} data-pc={w.p[i].pc === k ? '' : undefined} data-cs={l.kind === 'cs' || undefined}>
                  <code>{l.text(i)}</code>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <ol className="nb-race-log" aria-label="Event log">
          {w.log.slice(-7).map((l, k) => (
            <li key={k}>{l}</li>
          ))}
        </ol>
      </div>
    </SimFrame>
  );
}
