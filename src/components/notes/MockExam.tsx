'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MockPaper, MockQuestion } from '@/lib/notes';
import { useSiteTheme, useStored } from './reader-state';

/**
 * Runs one mock paper in the browser: answer, submit, review.
 *
 * The paper (questions AND answers) arrives as props from the server page, so
 * it travels in the gated RSC payload - never in a public JS chunk. Text that
 * needs Markdown/KaTeX is rendered on the server and handed over as `text`.
 *
 * Progress is saved in localStorage under `<storageKey>` until "Start again".
 */

type LongAnswer = { notes: string[]; paper?: boolean };
type Answer = number | number[] | string | LongAnswer | undefined;
const isLong = (a: Answer): a is LongAnswer => typeof a === 'object' && a !== null && !Array.isArray(a);
type State = {
  startedAt: number | null;
  submittedAt: number | null;
  timed: boolean;
  answers: Record<string, Answer>;
  flags: string[];
  rubric: Record<string, boolean[]>;
};
const EMPTY: State = { startedAt: null, submittedAt: null, timed: true, answers: {}, flags: [], rubric: {} };

type Result = { got: number; max: number; status: 'right' | 'part' | 'wrong' | 'open' };

/** A stable shuffle per question, so the order puzzle looks the same after a reload. */
function shuffled(n: number, seedText: string): number[] {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.every((v, i) => v === i) && n > 1) [a[0], a[1]] = [a[1], a[0]]; // never pre-solved
  return a;
}

function orderOf(q: Extract<MockQuestion, { kind: 'order' }>, a: Answer): number[] {
  return Array.isArray(a) && a.length === q.lines.length ? a : shuffled(q.lines.length, q.id);
}

function answered(q: MockQuestion, a: Answer): boolean {
  switch (q.kind) {
    case 'mcq':
      return typeof a === 'number';
    case 'fill':
      return Array.isArray(a) && a.length === q.blanks.length && a.every((x) => x >= 0);
    case 'order':
      return Array.isArray(a);
    case 'spot':
      return Array.isArray(a) && a.length > 0;
    case 'code':
      return typeof a === 'string' && a.trim() !== '' && a !== q.starter;
    case 'long':
      return isLong(a) && (!!a.paper || a.notes.some((n) => n && n.trim() !== ''));
  }
}

function mark(q: MockQuestion, a: Answer, rubric: boolean[] | undefined): Result {
  const half = (x: number) => Math.round(x * 2) / 2;
  switch (q.kind) {
    case 'mcq': {
      const ok = a === q.answer;
      return { got: ok ? q.marks : 0, max: q.marks, status: ok ? 'right' : 'wrong' };
    }
    case 'fill': {
      const arr = Array.isArray(a) ? a : [];
      const right = q.blanks.filter((b, i) => arr[i] === b.answer).length;
      const got = half((q.marks * right) / q.blanks.length);
      return { got, max: q.marks, status: right === q.blanks.length ? 'right' : right ? 'part' : 'wrong' };
    }
    case 'order': {
      if (!Array.isArray(a)) return { got: 0, max: q.marks, status: 'wrong' };
      const right = a.filter((v, i) => v === i).length;
      const got = half((q.marks * right) / q.lines.length);
      return { got, max: q.marks, status: right === q.lines.length ? 'right' : right ? 'part' : 'wrong' };
    }
    case 'spot': {
      const sel = Array.isArray(a) ? [...a].sort((x, y) => x - y) : [];
      const want = [...q.answer].sort((x, y) => x - y);
      const ok = sel.length === want.length && sel.every((v, i) => v === want[i]);
      return { got: ok ? q.marks : 0, max: q.marks, status: ok ? 'right' : 'wrong' };
    }
    case 'code': {
      if (!rubric) return { got: 0, max: q.marks, status: 'open' };
      const got = q.rubric.reduce((s, r, i) => s + (rubric[i] ? r.marks : 0), 0);
      return { got, max: q.marks, status: got === q.marks ? 'right' : got ? 'part' : 'wrong' };
    }
    case 'long': {
      if (!rubric) return { got: 0, max: q.marks, status: 'open' };
      const pts = q.parts.flatMap((p) => p.points);
      const got = pts.reduce((s, r, i) => s + (rubric[i] ? r.marks : 0), 0);
      return { got, max: q.marks, status: got === q.marks ? 'right' : got ? 'part' : 'wrong' };
    }
  }
}

const KIND_LABEL: Record<MockQuestion['kind'], string> = {
  mcq: 'MCQ',
  fill: 'Fill the gaps',
  order: 'Arrange the lines',
  spot: 'Spot the line',
  code: 'Write the code',
  long: 'Structured',
};

export function MockExam({
  paper,
  code,
  courseTitle,
  storageKey,
  backHref,
  text,
}: {
  paper: MockPaper;
  code: string;
  courseTitle: string;
  storageKey: string;
  backHref: string;
  text: Record<string, ReactNode>;
}) {
  const [state, setState] = useStored<State>(storageKey, EMPTY);
  const [theme, setTheme] = useStored<'auto' | 'dark' | 'reading' | 'light'>('nb-reader-theme', 'auto');
  const siteTheme = useSiteTheme();
  const effective = theme === 'auto' ? siteTheme : theme;
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const main = useRef<HTMLDivElement>(null);

  const all = useMemo(() => paper.sections.flatMap((s) => s.questions), [paper]);
  const numberOf = useMemo(() => new Map(all.map((q, i) => [q.id, i + 1])), [all]);
  const total = all.reduce((s, q) => s + q.marks, 0);
  const submitted = state.submittedAt !== null;
  const running = state.startedAt !== null && !submitted;

  // Keep a ref to the latest state so the timer can submit without re-arming.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const deadline = state.startedAt !== null && state.timed ? state.startedAt + paper.minutes * 60_000 : null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const s = stateRef.current;
      if (s.timed && s.startedAt !== null && s.submittedAt === null && n >= s.startedAt + paper.minutes * 60_000)
        setState({ ...s, submittedAt: n }); // time is up: hand the paper in
    }, 1000);
    return () => clearInterval(t);
  }, [running, paper.minutes, setState]);

  const update = (patch: Partial<State>) => setState({ ...state, ...patch });
  const setAnswer = (id: string, a: Answer) => update({ answers: { ...state.answers, [id]: a } });
  const toggleFlag = (id: string) =>
    update({ flags: state.flags.includes(id) ? state.flags.filter((f) => f !== id) : [...state.flags, id] });

  const results = useMemo(() => {
    const r = new Map<string, Result>();
    for (const q of all) r.set(q.id, mark(q, state.answers[q.id], state.rubric[q.id]));
    return r;
  }, [all, state.answers, state.rubric]);
  const scoreOf = (qs: MockQuestion[]) => qs.reduce((s, q) => s + (results.get(q.id)?.got ?? 0), 0);
  const answeredCount = all.filter((q) => answered(q, state.answers[q.id])).length;
  const remaining = deadline ? Math.max(0, deadline - now) : null;
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const jump = (id: string) => {
    setSideOpen(false);
    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ------------------------------------------------------------ intro
  if (state.startedAt === null) {
    return (
      <div className="nb nb-reader nb-mock" data-rtheme={effective} data-panel="closed">
        <div className="nb-r-main nb-mock-intro-wrap">
          <div className="nb-mock-intro nb-card">
            <Link href={backHref} className="nb-r-back">
              ← Mock papers
            </Link>
            <p className="nb-code" style={{ marginTop: '1rem' }}>
              {code} · {courseTitle}
            </p>
            <h1 className="nb-display">{paper.title}</h1>
            <div className="nb-prose nb-mock-text">{text.intro}</div>
            <table className="nb-mock-struct">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Questions</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {paper.sections.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.id}.</b> {s.title}
                    </td>
                    <td>{s.questions.length}</td>
                    <td>{s.questions.reduce((a, q) => a + q.marks, 0)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>Total</b>
                  </td>
                  <td>{all.length}</td>
                  <td>
                    <b>{total}</b>
                  </td>
                </tr>
              </tbody>
            </table>
            <label className="nb-check nb-mock-timed">
              <input type="checkbox" checked={state.timed} onChange={(e) => update({ timed: e.target.checked })} />
              Timed: {paper.minutes} minutes, handed in automatically when time runs out
            </label>
            <button
              type="button"
              className="nb-btn nb-btn-primary"
              onClick={() => {
                const n = Date.now();
                setNow(n);
                update({ startedAt: n });
              }}
            >
              Start the paper →
            </button>
            <p className="nb-fine">Answers are saved in this browser as you go, so you can close the tab and resume.</p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ paper / review
  const pct = Math.round((scoreOf(all) / total) * 100);
  return (
    <div
      className="nb nb-reader nb-mock"
      data-rtheme={effective}
      data-panel="closed"
      data-side={sideOpen ? 'open' : 'closed'}
    >
      <aside className="nb-r-side" aria-label="Paper navigation">
        <div className="nb-r-side-top">
          <Link href={backHref} className="nb-r-back">
            ← Mock papers
          </Link>
          <button type="button" className="nb-r-x nb-r-only-narrow" onClick={() => setSideOpen(false)} aria-label="Close">
            ×
          </button>
        </div>
        <p className="nb-r-title">
          <b>{code}</b> · {paper.title}
        </p>
        <div className="nb-r-tools">
          <div className="nb-r-group" role="radiogroup" aria-label="Theme">
            {(['dark', 'reading', 'light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={effective === t}
                className="nb-r-icon"
                onClick={() => setTheme(t)}
                title={`${t[0].toUpperCase()}${t.slice(1)} theme`}
              >
                {t === 'dark' ? '☾' : t === 'reading' ? '📖' : '☀'}
              </button>
            ))}
          </div>
        </div>

        {running ? (
          <div className="nb-mock-clock" data-low={remaining !== null && remaining < 10 * 60_000 ? '' : undefined}>
            <span>{remaining !== null ? 'Time left' : 'Untimed'}</span>
            <b>{remaining !== null ? mmss(remaining) : mmss(now - (state.startedAt ?? now))}</b>
          </div>
        ) : (
          <div className="nb-mock-clock nb-mock-score">
            <span>Score</span>
            <b>
              {scoreOf(all)} / {total}
            </b>
            <span>{pct}%</span>
          </div>
        )}
        <p className="nb-r-progress">
          {submitted ? 'Reviewed answers' : `${answeredCount} of ${all.length} answered`}
          {state.flags.length > 0 && ` · ${state.flags.length} flagged`}
        </p>

        {paper.sections.map((s) => (
          <div key={s.id} className="nb-mock-navsec">
            <p className="nb-eyebrow">
              {s.id}. {s.title}
              {submitted && (
                <span className="nb-mock-secscore">
                  {scoreOf(s.questions)}/{s.questions.reduce((a, q) => a + q.marks, 0)}
                </span>
              )}
            </p>
            <div className="nb-mock-grid">
              {s.questions.map((q) => {
                const r = results.get(q.id)!;
                const st = submitted ? r.status : answered(q, state.answers[q.id]) ? 'done' : 'todo';
                return (
                  <button
                    key={q.id}
                    type="button"
                    className="nb-mock-cell"
                    data-st={st}
                    data-flag={state.flags.includes(q.id) || undefined}
                    onClick={() => jump(q.id)}
                    aria-label={`Question ${numberOf.get(q.id)}`}
                  >
                    {numberOf.get(q.id)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="nb-r-foot">
          <ul className="nb-r-legend">
            {submitted ? (
              <>
                <li><span className="nb-mock-cell" data-st="right">✓</span> full marks</li>
                <li><span className="nb-mock-cell" data-st="part">½</span> part marks</li>
                <li><span className="nb-mock-cell" data-st="wrong">✗</span> no marks</li>
                <li><span className="nb-mock-cell" data-st="open">?</span> mark it yourself</li>
              </>
            ) : (
              <>
                <li><span className="nb-mock-cell" data-st="done">1</span> answered</li>
                <li><span className="nb-mock-cell" data-flag="">1</span> flagged for review</li>
              </>
            )}
          </ul>
          {running ? (
            <button type="button" className="nb-btn nb-btn-primary nb-btn-block" onClick={() => setConfirm(true)}>
              Submit paper
            </button>
          ) : (
            <button type="button" className="nb-btn nb-btn-block" onClick={() => setState({ ...EMPTY, timed: state.timed })}>
              Start again
            </button>
          )}
        </div>
      </aside>

      <div className="nb-r-main" ref={main}>
        <div className="nb-content nb-mock-content">
          <header className="nb-guide-head">
            <p className="nb-code">{code} · Mock paper</p>
            <h1 className="nb-display">{paper.title}</h1>
            {submitted && (
              <div className="nb-mock-result nb-card nb-tint-mint">
                <p className="nb-h2">
                  {scoreOf(all)} / {total} ({pct}%)
                </p>
                <ul>
                  {paper.sections.map((s) => (
                    <li key={s.id}>
                      <b>
                        {s.id}. {s.title}:
                      </b>{' '}
                      {scoreOf(s.questions)} / {s.questions.reduce((a, q) => a + q.marks, 0)}
                    </li>
                  ))}
                </ul>
                {all.some((q) => q.kind === 'code') && (
                  <p className="nb-fine">
                    The coding question counts once you tick its mark scheme below - compare your answer with the
                    model solution honestly.
                  </p>
                )}
                {all.some((q) => q.kind === 'long') && (
                  <p className="nb-fine">
                    Written questions count once you tick their mark schemes below. Compare your working with each
                    model answer and tick only the points you actually made.
                  </p>
                )}
              </div>
            )}
          </header>

          {paper.sections.map((s) => (
            <section key={s.id} className="nb-mock-section">
              <h2 className="nb-mock-sechead">
                <span>{s.id}</span> {s.title}
                <small>{s.questions.reduce((a, q) => a + q.marks, 0)} marks</small>
              </h2>
              <div className="nb-prose nb-mock-text">{text[`sec:${s.id}`]}</div>
              {s.questions.map((q, qi) => (
                <Fragment key={q.id}>
                  {q.scenario && s.questions[qi - 1]?.scenario !== q.scenario && (
                    <aside className="nb-mock-scenario" id={`scn-${s.id}-${q.scenario}`}>
                      <p className="nb-eyebrow">
                        {s.scenarios?.find((c) => c.id === q.scenario)?.title ?? 'Scenario'} - questions{' '}
                        {numberOf.get(q.id)}–{numberOf.get(s.questions.filter((x) => x.scenario === q.scenario).at(-1)!.id)}
                      </p>
                      <div className="nb-prose">{text[`scn:${s.id}:${q.scenario}`]}</div>
                    </aside>
                  )}
                <QuestionCard
                  key={q.id}
                  q={q}
                  n={numberOf.get(q.id)!}
                  answer={state.answers[q.id]}
                  onAnswer={(a) => setAnswer(q.id, a)}
                  flagged={state.flags.includes(q.id)}
                  onFlag={() => toggleFlag(q.id)}
                  submitted={submitted}
                  result={results.get(q.id)!}
                  rubric={state.rubric[q.id]}
                  onRubric={(r) => update({ rubric: { ...state.rubric, [q.id]: r } })}
                  text={text}
                  scenarioLabel={q.scenario ? s.scenarios?.find((c) => c.id === q.scenario)?.title : undefined}
                  scenarioHref={q.scenario ? `#scn-${s.id}-${q.scenario}` : undefined}
                />
                </Fragment>
              ))}
            </section>
          ))}
          {running && (
            <p className="nb-mock-end">
              <button type="button" className="nb-btn nb-btn-primary" onClick={() => setConfirm(true)}>
                Submit paper
              </button>
            </p>
          )}
        </div>
      </div>

      <button type="button" className="nb-r-fab nb-r-only-narrow" onClick={() => setSideOpen(true)}>
        ☰ Questions{remaining !== null && running ? ` · ${mmss(remaining)}` : ''}
      </button>

      {confirm && (
        <div className="nb-mock-modal" role="dialog" aria-modal="true" aria-labelledby="nb-submit-title">
          <div className="nb-card">
            <p className="nb-h2" id="nb-submit-title">
              Submit the paper?
            </p>
            <p>
              {answeredCount} of {all.length} questions answered
              {all.length - answeredCount > 0 && <b> - {all.length - answeredCount} left blank</b>}
              {state.flags.length > 0 && `, ${state.flags.length} still flagged`}. After submitting you see the marks,
              correct answers and explanations.
            </p>
            <div className="nb-btnrow">
              <button type="button" className="nb-btn" onClick={() => setConfirm(false)}>
                Keep working
              </button>
              <button
                type="button"
                className="nb-btn nb-btn-primary"
                onClick={() => {
                  setConfirm(false);
                  update({ submittedAt: Date.now() });
                  main.current?.scrollTo({ top: 0 });
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  n,
  answer,
  onAnswer,
  flagged,
  onFlag,
  submitted,
  result,
  rubric,
  onRubric,
  text,
  scenarioLabel,
  scenarioHref,
}: {
  scenarioLabel?: string;
  scenarioHref?: string;
  q: MockQuestion;
  n: number;
  answer: Answer;
  onAnswer: (a: Answer) => void;
  flagged: boolean;
  onFlag: () => void;
  submitted: boolean;
  result: Result;
  rubric: boolean[] | undefined;
  onRubric: (r: boolean[]) => void;
  text: Record<string, ReactNode>;
}) {
  return (
    <article id={`q-${q.id}`} className="nb-q" data-st={submitted ? result.status : undefined}>
      <header className="nb-q-head">
        <span className="nb-q-num">Q{n}</span>
        <span className="nb-tag">{KIND_LABEL[q.kind]}</span>
        {q.lab && <span className="nb-tag nb-tag-lab">{q.lab}</span>}
        {scenarioLabel && (
          <a className="nb-tag nb-tag-scn" href={scenarioHref}>
            {scenarioLabel} ↑
          </a>
        )}
        <span className="nb-q-marks">
          {submitted ? `${result.got} / ${q.marks}` : `${q.marks} mark${q.marks === 1 ? '' : 's'}`}
        </span>
        {!submitted && (
          <button type="button" className="nb-q-flag" aria-pressed={flagged} onClick={onFlag} title="Flag for review">
            {flagged ? '⚑ Flagged' : '⚐ Flag'}
          </button>
        )}
      </header>
      <div className="nb-prose nb-q-prompt">{text[`${q.id}:prompt`]}</div>

      {q.kind === 'mcq' && (
        <div className="nb-q-options" role="radiogroup">
          {q.options.map((_, i) => {
            const chosen = answer === i;
            const state = submitted ? (i === q.answer ? 'right' : chosen ? 'wrong' : undefined) : undefined;
            return (
              <label key={i} className="nb-q-option" data-chosen={chosen || undefined} data-st={state}>
                <input
                  type="radio"
                  name={q.id}
                  checked={chosen}
                  disabled={submitted}
                  onChange={() => onAnswer(i)}
                />
                <span className="nb-q-letter">{String.fromCharCode(65 + i)}</span>
                <span className="nb-q-optext">{text[`${q.id}:opt:${i}`]}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.kind === 'fill' && <FillCode q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />}
      {q.kind === 'order' && <OrderLines q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />}
      {q.kind === 'spot' && <SpotLine q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} />}
      {q.kind === 'code' && (
        <WriteCode q={q} answer={answer} onAnswer={onAnswer} submitted={submitted} rubric={rubric} onRubric={onRubric} />
      )}
      {q.kind === 'long' && (
        <LongParts
          q={q}
          answer={answer}
          onAnswer={onAnswer}
          submitted={submitted}
          rubric={rubric}
          onRubric={onRubric}
          text={text}
        />
      )}

      {submitted && (
        <div className="nb-q-explain">
          <p className="nb-eyebrow">{q.kind === 'long' ? "Examiner's notes" : 'Explanation'}</p>
          <div className="nb-prose">{text[`${q.id}:explain`]}</div>
        </div>
      )}
    </article>
  );
}

function FillCode({
  q,
  answer,
  onAnswer,
  submitted,
}: {
  q: Extract<MockQuestion, { kind: 'fill' }>;
  answer: Answer;
  onAnswer: (a: Answer) => void;
  submitted: boolean;
}) {
  const picks = Array.isArray(answer) ? answer : q.blanks.map(() => -1);
  const parts = q.code.split(/⟦(\d+)⟧/);
  return (
    <pre className="nb-q-code">
      <code>
        {parts.map((p, i) => {
          if (i % 2 === 0) return <span key={i}>{p}</span>;
          const b = Number(p) - 1;
          const blank = q.blanks[b];
          const ok = picks[b] === blank.answer;
          return (
            <span key={i} className="nb-q-blank" data-st={submitted ? (ok ? 'right' : 'wrong') : undefined}>
              <select
                aria-label={`Gap ${b + 1}`}
                value={picks[b]}
                disabled={submitted}
                onChange={(e) => {
                  const next = [...picks];
                  next[b] = Number(e.target.value);
                  onAnswer(next);
                }}
              >
                <option value={-1}>⟨ gap {b + 1} ⟩</option>
                {blank.options.map((o, k) => (
                  <option key={k} value={k}>
                    {o}
                  </option>
                ))}
              </select>
              {submitted && !ok && <span className="nb-q-fix">→ {blank.options[blank.answer]}</span>}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function OrderLines({
  q,
  answer,
  onAnswer,
  submitted,
}: {
  q: Extract<MockQuestion, { kind: 'order' }>;
  answer: Answer;
  onAnswer: (a: Answer) => void;
  submitted: boolean;
}) {
  const order = orderOf(q, answer);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onAnswer(next);
  };
  return (
    <div className="nb-q-order-wrap">
      <ol className="nb-q-order">
        {order.map((lineIdx, pos) => (
          <li
            key={lineIdx}
            draggable={!submitted}
            data-dragging={drag === pos || undefined}
            data-st={submitted ? (lineIdx === pos ? 'right' : 'wrong') : undefined}
            onDragStart={(e) => {
              setDrag(pos);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag !== null) move(drag, pos);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
          >
            {!submitted && <span className="nb-q-grip" aria-hidden="true">⠿</span>}
            <code>{q.lines[lineIdx]}</code>
            {!submitted && (
              <span className="nb-q-move">
                <button type="button" onClick={() => move(pos, pos - 1)} aria-label="Move up" disabled={pos === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(pos, pos + 1)}
                  aria-label="Move down"
                  disabled={pos === order.length - 1}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!submitted && answer === undefined && (
        <p className="nb-fine">Drag the lines (or use ↑ ↓) into the right order. Untouched counts as unanswered.</p>
      )}
      {submitted && (
        <div className="nb-q-correct">
          <p className="nb-eyebrow">Correct order</p>
          <pre className="nb-q-code">
            <code>{q.lines.join('\n')}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

function SpotLine({
  q,
  answer,
  onAnswer,
  submitted,
}: {
  q: Extract<MockQuestion, { kind: 'spot' }>;
  answer: Answer;
  onAnswer: (a: Answer) => void;
  submitted: boolean;
}) {
  const sel = Array.isArray(answer) ? answer : [];
  const lines = q.code.split('\n');
  const toggle = (n: number) => {
    if (submitted) return;
    if (q.answer.length === 1) onAnswer([n]);
    else onAnswer(sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]);
  };
  return (
    <div className="nb-q-spot">
      <p className="nb-fine">
        Click {q.answer.length === 1 ? 'the line' : `the ${q.answer.length} lines`} to select.
      </p>
      <pre className="nb-q-code nb-q-lines">
        {lines.map((l, i) => {
          const n = i + 1;
          const picked = sel.includes(n);
          const st = submitted ? (q.answer.includes(n) ? 'right' : picked ? 'wrong' : undefined) : undefined;
          return (
            <button
              key={i}
              type="button"
              className="nb-q-line"
              data-picked={picked || undefined}
              data-st={st}
              onClick={() => toggle(n)}
              disabled={submitted}
            >
              <span className="nb-q-ln">{n}</span>
              <code>{l || ' '}</code>
            </button>
          );
        })}
      </pre>
    </div>
  );
}

function WriteCode({
  q,
  answer,
  onAnswer,
  submitted,
  rubric,
  onRubric,
}: {
  q: Extract<MockQuestion, { kind: 'code' }>;
  answer: Answer;
  onAnswer: (a: Answer) => void;
  submitted: boolean;
  rubric: boolean[] | undefined;
  onRubric: (r: boolean[]) => void;
}) {
  const value = typeof answer === 'string' ? answer : q.starter;
  const ticks = rubric ?? q.rubric.map(() => false);
  return (
    <div className="nb-q-write">
      <textarea
        className="nb-q-editor"
        spellCheck={false}
        value={value}
        readOnly={submitted}
        rows={Math.min(28, Math.max(12, value.split('\n').length + 2))}
        onChange={(e) => onAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Tab' || submitted) return;
          e.preventDefault(); // Tab indents instead of leaving the editor
          const t = e.currentTarget;
          const { selectionStart: a, selectionEnd: b } = t;
          const next = value.slice(0, a) + '    ' + value.slice(b);
          onAnswer(next);
          requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
        }}
        aria-label="Your code"
      />
      {submitted && (
        <>
          <div className="nb-q-correct">
            <p className="nb-eyebrow">Model solution</p>
            <pre className="nb-q-code">
              <code>{q.solution}</code>
            </pre>
          </div>
          <fieldset className="nb-q-rubric">
            <legend>Mark scheme - tick what your answer does</legend>
            {q.rubric.map((r, i) => (
              <label key={i} className="nb-check">
                <input
                  type="checkbox"
                  checked={ticks[i]}
                  onChange={(e) => {
                    const next = [...ticks];
                    next[i] = e.target.checked;
                    onRubric(next);
                  }}
                />
                <span>
                  {r.text} <b>({r.marks})</b>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}

/** A structured written question: parts with optional typed working, then model answers and a tick-box mark scheme. */
function LongParts({
  q,
  answer,
  onAnswer,
  submitted,
  rubric,
  onRubric,
  text,
}: {
  q: Extract<MockQuestion, { kind: 'long' }>;
  answer: Answer;
  onAnswer: (a: Answer) => void;
  submitted: boolean;
  rubric: boolean[] | undefined;
  onRubric: (r: boolean[]) => void;
  text: Record<string, ReactNode>;
}) {
  const a: LongAnswer = isLong(answer) ? answer : { notes: q.parts.map(() => '') };
  const flat = q.parts.flatMap((p) => p.points);
  const ticks = rubric ?? flat.map(() => false);
  // index of each part's first point in the flat rubric
  const starts = q.parts.map((_, i) => q.parts.slice(0, i).reduce((n, p) => n + p.points.length, 0));
  return (
    <div className="nb-q-long">
      {!submitted && (
        <label className="nb-check nb-q-paper">
          <input type="checkbox" checked={!!a.paper} onChange={(e) => onAnswer({ ...a, paper: e.target.checked })} />
          <span>I answered this question on paper</span>
        </label>
      )}
      {q.parts.map((p, i) => {
        const start = starts[i];
        const got = p.points.reduce((s, r, k) => s + (ticks[start + k] ? r.marks : 0), 0);
        return (
          <section key={i} className="nb-q-part">
            <header className="nb-q-part-head">
              <b>({p.label})</b>
              <span className="nb-q-part-marks">{submitted ? `${got} / ${p.marks}` : `[${p.marks}]`}</span>
            </header>
            <div className="nb-prose">{text[`${q.id}:p${i}:prompt`]}</div>
            {(!submitted || a.notes[i]?.trim()) && (
              <textarea
                className="nb-q-notes"
                placeholder={submitted ? '' : 'Working (optional) - or answer on paper and tick the box above'}
                value={a.notes[i] ?? ''}
                readOnly={submitted}
                rows={submitted ? Math.min(14, Math.max(3, (a.notes[i] ?? '').split('\n').length + 1)) : 4}
                onChange={(e) => {
                  const notes = [...a.notes];
                  notes[i] = e.target.value;
                  onAnswer({ ...a, notes });
                }}
                aria-label={`Your answer to part ${p.label}`}
              />
            )}
            {submitted && (
              <>
                <div className="nb-q-correct">
                  <p className="nb-eyebrow">Model answer</p>
                  <div className="nb-prose">{text[`${q.id}:p${i}:answer`]}</div>
                </div>
                <fieldset className="nb-q-rubric">
                  <legend>Mark scheme - tick what your answer has</legend>
                  {p.points.map((r, k) => (
                    <label key={k} className="nb-check">
                      <input
                        type="checkbox"
                        checked={ticks[start + k]}
                        onChange={(e) => {
                          const next = [...ticks];
                          next[start + k] = e.target.checked;
                          onRubric(next);
                        }}
                      />
                      <span>
                        {r.text} <b>({r.marks})</b>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
