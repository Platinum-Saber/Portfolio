'use client';

import { useEffect, useRef } from 'react';
import { MEASURED_ON, nodeAt, pathToHash } from '@/lib/chibi/graph';

type Props = {
  path: string[];
  onPath: (path: string[]) => void;
};

/**
 * The detail view for the open node: a teal glass panel (the reply panel from
 * her desktop overlay, in the site's glass) at the side on wide screens and as
 * a bottom sheet on phones. A breadcrumb walks back up the tree; a node made of
 * parts lists them, and each opens one level deeper. Non-modal: the graph
 * stays usable beside it.
 */
export function NodePanel({ path, onPath }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const node = nodeAt(path);

  // A new node moves focus to its heading, so keyboard and screen-reader users
  // land on what just opened.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [path]);

  if (!node) return null;
  const crumbs = path.map((_, i) => path.slice(0, i + 1));

  return (
    <aside
      id="chibi-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="chibi-panel-title"
      className="chibi-panel chibi-glass glass glass-blur absolute z-20 flex flex-col"
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0">
          <nav aria-label="Where you are" className="chibi-crumbs font-mono text-[11px] tracking-[0.08em]">
            <ol className="flex flex-wrap items-center gap-x-1.5">
              <li>
                <button type="button" onClick={() => onPath([])}>
                  Architecture
                </button>
              </li>
              {crumbs.map((c, i) => {
                const n = nodeAt(c);
                const last = i === crumbs.length - 1;
                return (
                  <li key={pathToHash(c)} className="flex items-center gap-x-1.5">
                    <span aria-hidden>›</span>
                    {last ? (
                      <span aria-current="location">{n?.label}</span>
                    ) : (
                      <button type="button" onClick={() => onPath(c)}>
                        {n?.label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <h2 id="chibi-panel-title" ref={heading} tabIndex={-1} className="mt-1.5 text-xl font-semibold outline-none">
            <span aria-hidden className="mr-2 font-mono text-[var(--chibi-cyan)]">
              {node.glyph}
            </span>
            {node.label}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{node.tagline}</p>
        </div>
        <button
          type="button"
          onClick={() => onPath(path.slice(0, -1))}
          className="glass-btn shrink-0 px-3 py-1.5 font-mono text-xs"
        >
          Back <span className="sr-only">one level</span>
          <kbd className="ml-1.5 hidden text-[10px] opacity-60 sm:inline">Esc</kbd>
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-5">
        <p className="text-[15px] leading-relaxed">{node.summary}</p>

        {node.children && (
          <div>
            <h3 className="font-mono text-[11px] tracking-[0.18em] text-[var(--fg-muted)] uppercase">
              {node.children.length} parts
            </h3>
            <ul className="mt-2 grid gap-1.5">
              {node.children.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    className="chibi-part flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
                    onClick={() => onPath([...path, k.id])}
                  >
                    <span aria-hidden className="chibi-part-glyph font-mono">
                      {k.glyph}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{k.label}</span>
                      <span className="block text-xs text-[var(--fg-muted)]">{k.tagline}</span>
                    </span>
                    <span aria-hidden className="ml-auto font-mono text-xs opacity-60">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {node.stats && node.stats.length > 0 && (
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

        {node.stack && node.stack.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Stack">
            {node.stack.map((s) => (
              <li key={s} className="chibi-tag px-2 py-0.5 font-mono text-[11px]">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
