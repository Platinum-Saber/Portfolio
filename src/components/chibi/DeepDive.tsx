import { MEASURED_ON, intro, roots, type ChibiNode } from '@/lib/chibi/graph';

/**
 * Everything the scroll story shows, as plain HTML: the fallback for when the
 * graph cannot be shown (no JS, or the story failed to start). It is always in
 * the server HTML, so crawlers and no-JS visitors get every word, and hidden by
 * CSS once ChibiStory has mounted (`html[data-chibi-ready]`, globals.css), so a
 * working page shows the graph only. Rendered from the same tree as the graph
 * (parts nest under their node), so the two always agree.
 */
export function DeepDive() {
  return (
    <div className="chibi-deep-dive mt-16 space-y-14">
      <noscript>
        <div className="mb-10">
          <p className="font-mono text-xs tracking-[0.18em] text-[var(--accent)] uppercase">{intro.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{intro.title}</h1>
          <p className="mt-2 text-lg">{intro.subtitle}</p>
          <p className="mt-3 text-[var(--fg-muted)]">{intro.body}</p>
        </div>
      </noscript>

      <header>
        <p className="font-mono text-xs tracking-[0.18em] text-[var(--accent)] uppercase">The whole system</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">How she is built</h2>
        <p className="mt-3 leading-relaxed text-[var(--fg-muted)]">
          Four local processes (her body, the agent, the voice and the language model) around one turn loop.
          Each part below is a node in the graph above. {MEASURED_ON}
        </p>
        <nav aria-label="Parts" className="mt-4 flex flex-wrap gap-1.5">
          {roots.map((n) => (
            <a key={n.id} href={`#about-${n.id}`} className="glass-chip px-2.5 py-1 font-mono text-xs">
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      {roots.map((n) => (
        <Part key={n.id} node={n} anchor={`about-${n.id}`} depth={0} />
      ))}

      <section aria-labelledby="about-voice-note">
        <h2 id="about-voice-note" className="text-lg font-semibold">A note on her voice</h2>
        <p className="mt-2 leading-relaxed text-[var(--fg-muted)]">
          Her voice is cloned from a character’s original lines and is used for personal purposes on one machine
          only. It is never published, so no audio of her is included on this page: the speaking core above is
          driven by a made-up level.
        </p>
      </section>
    </div>
  );
}

function Part({ node, anchor, depth }: { node: ChibiNode; anchor: string; depth: number }) {
  const H = depth === 0 ? 'h2' : 'h3';
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-h`}
      className={depth === 0 ? 'scroll-mt-24' : 'scroll-mt-24 border-l border-[var(--border)] pl-4'}
    >
      <p className="font-mono text-xs text-[var(--fg-muted)]">
        <span aria-hidden className="mr-1.5 text-[var(--accent)]">{node.glyph}</span>
        {node.tagline}
      </p>
      <H id={`${anchor}-h`} className={`mt-1 font-semibold tracking-tight ${depth === 0 ? 'text-xl' : 'text-base'}`}>
        {node.label}
      </H>
      <p className="mt-2 leading-relaxed">{node.summary}</p>

      {node.flow && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-snug">
          {node.flow.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {node.stats && node.stats.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {node.stats.map((s) => (
            <div key={s.label} className="glass px-3 py-2">
              <dt className="text-xs text-[var(--fg-muted)]">{s.label}</dt>
              <dd className="font-mono text-[var(--accent)]">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {node.stack && node.stack.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${node.label} stack`}>
          {node.stack.map((s) => (
            <li key={s} className="glass-chip px-2 py-0.5 font-mono text-[11px]">
              {s}
            </li>
          ))}
        </ul>
      )}

      {node.children && (
        <div className="mt-5 space-y-6">
          {node.children.map((k) => (
            <Part key={k.id} node={k} anchor={`${anchor}-${k.id}`} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
