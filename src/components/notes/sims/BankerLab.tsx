'use client';

import { useState } from 'react';
import { Select, SimFrame } from './SimFrame';

/**
 * Banker's algorithm on the classic 5-process / 3-resource example. Make a
 * request, and the sim runs the request checks, pretends to grant it, then
 * steps the safety algorithm (Work / Finish) to decide.
 */

type V = number[];
const P = 5;
const ALLOC0: V[] = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]];
const MAX: V[] = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]];
const AVAIL0: V = [3, 3, 2];
const RES = ['A', 'B', 'C'];

const sub = (a: V, b: V) => a.map((x, i) => x - b[i]);
const add = (a: V, b: V) => a.map((x, i) => x + b[i]);
const le = (a: V, b: V) => a.every((x, i) => x <= b[i]);
const vec = (v: V) => `(${v.join(', ')})`;

type Step = { p: number; work: V; note: string };

function safety(alloc: V[], avail: V) {
  const need = MAX.map((m, i) => sub(m, alloc[i]));
  let work = [...avail];
  const finish = Array(P).fill(false);
  const steps: Step[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < P; i++) {
      if (!finish[i] && le(need[i], work)) {
        const before = work;
        work = add(work, alloc[i]);
        finish[i] = true;
        steps.push({ p: i, work, note: `Need${vec(need[i])} ≤ Work${vec(before)} → P${i} can finish, Work += Alloc${vec(alloc[i])}` });
        progress = true;
      }
    }
  }
  return { safe: finish.every(Boolean), steps, finish, need };
}

const PRESETS: { label: string; p: number; req: V }[] = [
  { label: 'P1 asks (1,0,2)', p: 1, req: [1, 0, 2] },
  { label: 'P4 asks (3,3,0)', p: 4, req: [3, 3, 0] },
  { label: 'P0 asks (0,2,0) - try after granting P1', p: 0, req: [0, 2, 0] },
  { label: 'P3 asks (0,1,1)', p: 3, req: [0, 1, 1] },
];

export function BankerLab() {
  const [alloc, setAlloc] = useState<V[]>(ALLOC0);
  const [avail, setAvail] = useState<V>(AVAIL0);
  const [p, setP] = useState(1);
  const [req, setReq] = useState<V>([1, 0, 2]);
  const [shown, setShown] = useState(99);
  const [verdict, setVerdict] = useState<{ ok: boolean; why: string; steps: Step[] } | null>(null);

  const base = safety(alloc, avail);
  const need = base.need;

  const check = () => {
    if (!le(req, need[p])) {
      setVerdict({ ok: false, why: `Error: Request${vec(req)} > Need${vec(need[p])} - P${p} asked for more than it declared.`, steps: [] });
      return;
    }
    if (!le(req, avail)) {
      setVerdict({ ok: false, why: `Wait: Request${vec(req)} > Available${vec(avail)} - not enough free now, P${p} blocks.`, steps: [] });
      return;
    }
    const a2 = alloc.map((r, i) => (i === p ? add(r, req) : r));
    const s = safety(a2, sub(avail, req));
    setShown(0);
    setVerdict({
      ok: s.safe,
      why: s.safe
        ? `Pretend-grant leaves a SAFE state (sequence ${s.steps.map((x) => `P${x.p}`).join(' → ')}) - grant it.`
        : `Pretend-grant leaves an UNSAFE state (only ${s.steps.map((x) => `P${x.p}`).join(', ') || 'nobody'} could finish) - roll back, P${p} waits.`,
      steps: s.steps,
    });
  };
  const grant = () => {
    setAlloc(alloc.map((r, i) => (i === p ? add(r, req) : r)));
    setAvail(sub(avail, req));
    setVerdict(null);
  };

  return (
    <SimFrame
      title="Banker's algorithm - grant only if a safe sequence survives"
      hint="Need = Max − Allocation. A request is checked against Need (else error) and Available (else wait), then granted on paper and the safety algorithm looks for an order in which every process can finish. Unsafe ≠ deadlocked - it means the OS can no longer guarantee to avoid one."
      controls={
        <>
          <div className="nb-btnrow">
            {PRESETS.map((x) => (
              <button key={x.label} type="button" className="nb-btn nb-btn-sm" onClick={() => { setP(x.p); setReq(x.req); setVerdict(null); }}>
                {x.label}
              </button>
            ))}
          </div>
          <Select label="process" value={String(p)} onChange={(v) => { setP(Number(v)); setVerdict(null); }}
            options={[...Array(P).keys()].map((i) => ({ value: String(i), label: `P${i}` }))} />
          {RES.map((r, k) => (
            <Select key={r} label={`request ${r}`} value={String(req[k])}
              onChange={(v) => { setReq(req.map((x, i) => (i === k ? Number(v) : x))); setVerdict(null); }}
              options={[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
          ))}
          <div className="nb-btnrow">
            <button type="button" className="nb-btn nb-btn-sm nb-btn-primary" onClick={check}>Check request</button>
            {verdict?.ok && <button type="button" className="nb-btn nb-btn-sm" onClick={grant}>Grant it</button>}
            {verdict && verdict.steps.length > 0 && shown < verdict.steps.length && (
              <button type="button" className="nb-btn nb-btn-sm" onClick={() => setShown(shown + 1)}>Next safety step</button>
            )}
            <button type="button" className="nb-btn nb-btn-sm" onClick={() => { setAlloc(ALLOC0); setAvail(AVAIL0); setVerdict(null); }}>Reset</button>
          </div>
        </>
      }
      readout={
        <p className="nb-sim-stat">
          Available <b>{vec(avail)}</b> · current state is {base.safe ? 'safe' : <b>UNSAFE</b>}
          {verdict && <> · <b>{verdict.why}</b></>}
        </p>
      }
    >
      <div className="nb-banker">
        <table>
          <thead>
            <tr>
              <th>Proc</th><th>Allocation</th><th>Max</th><th>Need</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(P).keys()].map((i) => (
              <tr key={i} data-sel={i === p || undefined}>
                <td>P{i}</td>
                <td>{alloc[i].join(' ')}</td>
                <td>{MAX[i].join(' ')}</td>
                <td>{need[i].join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ol className="nb-race-log" aria-label="Safety algorithm steps">
          {verdict?.steps.slice(0, Math.min(shown, verdict.steps.length)).map((s, k) => (
            <li key={k}>
              {s.note} = {vec(s.work)}
            </li>
          ))}
          {verdict && verdict.steps.length > 0 && shown >= verdict.steps.length && (
            <li data-bad={!verdict.ok || undefined}>{verdict.ok ? 'Finish all true → SAFE' : 'Some Finish[i] still false → UNSAFE'}</li>
          )}
          {!verdict && <li>Pick a request and press Check request.</li>}
        </ol>
      </div>
    </SimFrame>
  );
}
