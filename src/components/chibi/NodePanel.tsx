'use client';

import { useEffect, useRef } from 'react';
import { MEASURED_ON, type ChibiNode } from '@/lib/chibi/graph';

type Props = {
  node: ChibiNode;
  openBranch: string | null;
  onBranch: (id: string | null) => void;
  onClose: () => void;
};

/**
 * The detail view for one node: a teal glass panel (the reply panel from her
 * desktop overlay, in the site's glass) at the side on wide screens and as a
 * bottom sheet on phones. Non-modal: the graph stays usable beside it.
 */
export function NodePanel({ node, openBranch, onBranch, onClose }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const branchRefs = useRef(new Map<string, HTMLElement>());

  // A new node moves focus to its heading, so keyboard and screen-reader users
  // land on what just opened.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [node.id]);

  useEffect(() => {
    if (openBranch) branchRefs.current.get(openBranch)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openBranch]);

  return (
    <aside
      id="chibi-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="chibi-panel-title"
      className="chibi-panel chibi-glass glass glass-blur absolute z-20 flex flex-col"
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--chibi-cyan)] uppercase">
            {node.id === 'core' ? 'The core' : 'Subsystem'}
          </p>
          <h2 id="chibi-panel-title" ref={heading} tabIndex={-1} className="mt-1 text-xl font-semibold outline-none">
            {node.label}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{node.tagline}</p>
        </div>
        <button type="button" onClick={onClose} className="glass-btn shrink-0 px-3 py-1.5 font-mono text-xs">
          Back <span className="sr-only">to the graph</span>
          <kbd className="ml-1.5 hidden text-[10px] opacity-60 sm:inline">Esc</kbd>
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-5">
        <p className="text-[15px] leading-relaxed">{node.summary}</p>

        {node.flow && (
          <ol className="space-y-2">
            {node.flow.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-snug">
                <span className="chibi-step font-mono" aria-hidden>
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        {node.stats.length > 0 && (
          <div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {node.stats.map((s) => (
                <div key={s.label} className="chibi-stat rounded-lg px-3 py-2">
                  <dt className="text-[11px] leading-tight text-[var(--fg-muted)]">{s.label}</dt>
                  <dd className="mt-0.5 font-mono text-base text-[var(--chibi-cyan)]">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-[var(--fg-muted)]">{MEASURED_ON}</p>
          </div>
        )}

        <div>
          <h3 className="font-mono text-[11px] tracking-[0.18em] text-[var(--fg-muted)] uppercase">Branches</h3>
          <ul className="mt-2 space-y-1.5">
            {node.branches.map((b) => {
              const open = openBranch === b.id;
              return (
                <li
                  key={b.id}
                  ref={(el) => {
                    if (el) branchRefs.current.set(b.id, el);
                    else branchRefs.current.delete(b.id);
                  }}
                  className="chibi-branch-row rounded-lg"
                  data-open={open ? '' : undefined}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                    aria-expanded={open}
                    onClick={() => onBranch(open ? null : b.id)}
                  >
                    {b.label}
                    <span aria-hidden className="font-mono text-xs opacity-60">
                      {open ? '−' : '+'}
                    </span>
                  </button>
                  {open && <p className="px-3 pb-3 text-sm leading-relaxed text-[var(--fg-muted)]">{b.body}</p>}
                </li>
              );
            })}
          </ul>
        </div>

        {node.stack.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Stack">
            {node.stack.map((s) => (
              <li key={s} className="glass-chip px-2 py-0.5 font-mono text-[11px]">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
