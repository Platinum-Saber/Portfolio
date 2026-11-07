import type { ReactNode } from 'react';
import { readCodeOutput, readCodeRange } from '@/lib/notes';
import { highlight } from '@/lib/notes/highlight';
import { DoneToggle } from './GuideShell';
import { FeasibleDiagram, KktDiagram, LoopDiagram } from './diagrams';
import { CrossEntropyLab } from './sims/CrossEntropyLab';
import { DescentLab } from './sims/DescentLab';
import { IntervalSearch } from './sims/IntervalSearch';
import { LagrangeLab } from './sims/LagrangeLab';
import { NewtonLab } from './sims/NewtonLab';
import { PenaltyBarrierLab } from './sims/PenaltyBarrierLab';
import { WolfeLab } from './sims/WolfeLab';
import {
  ForkJoinDiagram,
  HandOverHandDiagram,
  MonitorDiagram,
  MpiCollectivesDiagram,
  RagDiagram,
} from './diagrams-pcp';
import {
  BackpropDiagram,
  FisDiagram,
  MadalineDiagram,
  NeuronDiagram,
  PnnDiagram,
  XorDiagram,
} from './diagrams-nnfl';
import { ActivationLab } from './sims/ActivationLab';
import { BackpropLab } from './sims/BackpropLab';
import { FuzzyTipLab } from './sims/FuzzyTipLab';
import { HedgeLab } from './sims/HedgeLab';
import { PerceptronLab } from './sims/PerceptronLab';
import { PnnLab } from './sims/PnnLab';
import { AmdahlLab } from './sims/AmdahlLab';
import { BankerLab } from './sims/BankerLab';
import { DiningLab } from './sims/DiningLab';
import { MutexLab } from './sims/MutexLab';
import { PipelineLab } from './sims/PipelineLab';
import { RaceLab } from './sims/RaceLab';
import { ScheduleLab } from './sims/ScheduleLab';

/**
 * The building blocks a guide's MDX is written in. All SERVER components -
 * their text stays in the gated page payload. Only DoneToggle is client-side,
 * and it carries no content.
 */

const TAGS: Record<string, string> = {
  exam: 'EXAM',
  core: 'CORE',
  calc: 'CALC',
  code: 'CODE',
  note: 'NOTE',
};

export function Section({
  id,
  num,
  title,
  tags,
  pages,
  children,
}: {
  id: string;
  num: string;
  title: string;
  /** Space-separated keys of TAGS, e.g. "exam calc". */
  tags?: string;
  /** "Part 1 · pp. 18–36" - where the full treatment is. */
  pages?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="nb-section" data-section>
      <header className="nb-section-head">
        <span className="nb-section-num" aria-hidden="true">
          §{num}
        </span>
        <div className="nb-section-title">
          <h2>{title}</h2>
          <div className="nb-section-meta">
            {tags
              ?.split(/\s+/)
              .filter(Boolean)
              .map((t) => (
                <span key={t} className={`nb-tag nb-tag-${t}`}>
                  {TAGS[t] ?? t.toUpperCase()}
                </span>
              ))}
            {pages && <span className="nb-pages">{pages}</span>}
          </div>
        </div>
        <DoneToggle id={id} />
      </header>
      <div className="nb-prose">{children}</div>
    </section>
  );
}

/** Shown only in Detailed view: derivations, longer worked examples, asides. */
export function Detail({ children }: { children: ReactNode }) {
  return <div className="nb-detail">{children}</div>;
}

export function Callout({
  kind = 'key',
  title,
  children,
}: {
  kind?: 'key' | 'exam' | 'warn' | 'tip';
  title?: string;
  children: ReactNode;
}) {
  const icon = { key: '★', exam: '!', warn: '⚠', tip: '✓' }[kind];
  return (
    <aside className={`nb-callout nb-callout-${kind}`}>
      <span className="nb-callout-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        {title && <p className="nb-callout-title">{title}</p>}
        {children}
      </div>
    </aside>
  );
}

/** A worked problem: the question is visible, the full solution folds away. */
export function Worked({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="nb-worked">
      <summary>
        <span className="nb-worked-label">Worked</span>
        <span>{title}</span>
      </summary>
      <div className="nb-worked-body">{children}</div>
    </details>
  );
}

/** A recall prompt: try it first, then open the answer. */
export function Recall({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="nb-recall">
      <summary>{q}</summary>
      <div className="nb-recall-a">{children}</div>
    </details>
  );
}

export function RecallList({ children }: { children: ReactNode }) {
  return (
    <div className="nb-recall-list">
      <p className="nb-eyebrow">Recall - answer before you open</p>
      {children}
    </div>
  );
}

/** Opens the full PDF at a page. `page` is the PDF page index, not the printed number. */
export function PdfRef({
  file,
  page,
  children,
}: {
  file: string;
  /** A string in MDX (`page="42"`): next-mdx-remote v6 blocks JS expressions. */
  page: string | number;
  children: ReactNode;
}) {
  const n = Number(page);
  return (
    <a
      className="nb-pdfref"
      href={`/notes-files/${file}${Number.isFinite(n) && n > 0 ? `#page=${n}` : ''}`}
      target="_blank"
      rel="noopener"
    >
      {children} ↗
    </a>
  );
}

const LANG_LABEL: Record<string, string> = {
  c: 'C',
  shellscript: 'Shell Script',
  bash: 'Shell Script',
  sh: 'Shell Script',
  python: 'Python',
  java: 'Java',
  text: 'Plain Text',
};
const EXT: Record<string, string> = { c: 'c', python: 'py', java: 'java', shellscript: 'sh', bash: 'sh', sh: 'sh' };

/** The file-type glyph VS Code shows on a tab (a coloured letter badge). */
function FileIcon({ lang }: { lang: string }) {
  const g = { c: 'C', python: 'py', java: 'J', shellscript: '$', bash: '$', sh: '$' }[lang] ?? '≡';
  return (
    <span className="nb-vsc-icon" data-lang={lang} aria-hidden="true">
      {g}
    </span>
  );
}

/** VS Code-style editor chrome: tab strip, breadcrumb, editor, optional terminal, status bar. */
function Editor({
  name,
  lang,
  html,
  start = 1,
  lines,
  crumbs,
  note,
  cmd,
  output,
  tested,
}: {
  output?: string | null;
  name: string;
  lang: string;
  html: string;
  start?: number;
  lines: number;
  crumbs?: string[];
  note?: string;
  cmd?: string;
  tested?: boolean;
}) {
  return (
    <figure className="nb-vsc" style={{ ['--ln-start' as string]: start - 1 }}>
      <div className="nb-vsc-tabs">
        <span className="nb-vsc-tab" data-active="">
          <FileIcon lang={lang} />
          {name}
        </span>
        {note && <span className="nb-vsc-note">{note}</span>}
      </div>
      {crumbs && (
        <div className="nb-vsc-crumbs">
          {crumbs.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      )}
      <div className="nb-vsc-editor" dangerouslySetInnerHTML={{ __html: html }} />
      {cmd && (
        <div className="nb-vsc-term">
          <div className="nb-vsc-term-head">
            <span data-active="">Terminal</span>
            <span>Output</span>
            <span>Problems</span>
          </div>
          <pre>
            <span className="nb-vsc-prompt">$ </span>
            {cmd}
          </pre>
          {output && (
            <details className="nb-vsc-out">
              <summary>
                Output <span>· {output.split('\n').length} lines · one run on a 2-core machine; timings vary</span>
              </summary>
              <pre>{output}</pre>
            </details>
          )}
        </div>
      )}
      <figcaption className="nb-vsc-status">
        {tested && <span className="nb-vsc-ok" title="Compiled and run before publishing">✓ compiled &amp; run</span>}
        <span className="nb-vsc-status-r">
          <span>
            Ln {start}–{start + lines - 1}
          </span>
          <span>Spaces: 4</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span>{LANG_LABEL[lang] ?? 'Plain Text'}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * A source file from content/notes/ (lab solutions), read at build time - so
 * the page shows exactly the file that was compiled and tested.
 *
 * `from` / `to`: show only that part of the file, always.
 * `focus` / `focusTo`: the Summary view shows only that part (the lines that
 * answer the exercise); the Detailed view shows the whole file.
 */
export async function CodeFile({
  src,
  from,
  to,
  focus,
  focusTo,
  cmd,
}: {
  src: string;
  from?: string;
  to?: string;
  focus?: string;
  focusTo?: string;
  /** How it was built, e.g. "gcc -pthread -O0". */
  cmd?: string;
}) {
  const name = src.split('/').pop() ?? src;
  const ext = name.split('.').pop() ?? '';
  const lang = ext === 'c' || ext === 'h' ? 'c' : ext === 'py' ? 'python' : ext === 'java' ? 'java' : ext === 'sh' ? 'shellscript' : 'text';
  const crumbs = src.split('/').slice(-3);
  const output = readCodeOutput(src);
  const render = async (f?: string, t?: string, note?: string) => {
    const r = readCodeRange(src, f, t);
    const lines = r.end - r.start + 1;
    return (
      <Editor
        name={name}
        lang={lang}
        html={await highlight(r.code, lang)}
        start={r.start}
        lines={lines}
        crumbs={crumbs}
        note={note ?? (f || t ? `lines ${r.start}–${r.end} of ${r.total}` : undefined)}
        cmd={cmd}
        output={output}
        tested
      />
    );
  };
  if (!focus) return render(from, to);
  return (
    <>
      <div className="nb-summary-only">{await render(focus, focusTo, 'key lines · whole file in Detailed')}</div>
      <div className="nb-detail-only">{await render(from, to)}</div>
    </>
  );
}

/** Fenced code blocks in the guides (already highlighted by @shikijs/rehype). */
export function Pre(props: React.ComponentProps<'pre'> & { 'data-lang'?: string }) {
  const lang = props['data-lang'] ?? 'text';
  if (!String(props.className ?? '').includes('shiki')) return <pre {...props} />;
  return (
    <figure className="nb-vsc nb-vsc-snippet">
      <div className="nb-vsc-tabs">
        <span className="nb-vsc-tab" data-active="">
          <FileIcon lang={lang} />
          {lang === 'text' ? 'output.txt' : `snippet.${EXT[lang] ?? 'txt'}`}
        </span>
      </div>
      <div className="nb-vsc-editor">
        <pre {...props} />
      </div>
    </figure>
  );
}

export const guideComponents = {
  CodeFile,
  pre: Pre,
  Section,
  Detail,
  Callout,
  Worked,
  Recall,
  RecallList,
  PdfRef,
  // Interactive simulations (client components - algorithm code only, no
  // guide text) and static SVG diagrams (server-rendered).
  DescentLab,
  IntervalSearch,
  WolfeLab,
  NewtonLab,
  CrossEntropyLab,
  LagrangeLab,
  PenaltyBarrierLab,
  LoopDiagram,
  FeasibleDiagram,
  KktDiagram,
  // CS4533
  RaceLab,
  AmdahlLab,
  MutexLab,
  DiningLab,
  ScheduleLab,
  PipelineLab,
  BankerLab,
  ForkJoinDiagram,
  MonitorDiagram,
  RagDiagram,
  MpiCollectivesDiagram,
  HandOverHandDiagram,
  // MA4144
  ActivationLab,
  PerceptronLab,
  BackpropLab,
  FuzzyTipLab,
  HedgeLab,
  PnnLab,
  NeuronDiagram,
  XorDiagram,
  MadalineDiagram,
  BackpropDiagram,
  PnnDiagram,
  FisDiagram,
};
