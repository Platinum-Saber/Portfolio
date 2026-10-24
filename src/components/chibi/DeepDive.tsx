import { MEASURED_ON, core, intro, nodes, type ChibiNode } from '@/lib/chibi/graph';

/**
 * Everything the scroll story shows, as plain HTML in the normal column: the
 * page for visitors without JS or WebGL, for screen readers that would rather
 * read than explore a graph, and for anyone who scrolled past the story and
 * wants it all in one place. Rendered on the server from the same module as
 * the graph, so the two always agree.
 */
export function DeepDive() {
  return (
    <div className="mt-16 space-y-14">
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
          Four local processes (her body, the agent, the voice and the language model) around one turn
          loop. Each part below is a node in the graph above. {MEASURED_ON}
        </p>
        <nav aria-label="Parts" className="mt-4 flex flex-wrap gap-1.5">
          {[core, ...nodes].map((n) => (
            <a key={n.id} href={`#about-${n.id}`} className="glass-chip px-2.5 py-1 font-mono text-xs">
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      {[core, ...nodes].map((n) => (
        <Part key={n.id} node={n} />
      ))}

      <section aria-labelledby="about-voice-note">
        <h2 id="about-voice-note" className="text-lg font-semibold">A note on her voice</h2>
        <p className="mt-2 leading-relaxed text-[var(--fg-muted)]">
          Her voice is cloned from a character’s original lines for my own use on my own machine. It is never
          published, so this page has no audio of her: the speaking core above is driven by a made-up level.
        </p>
      </section>
    </div>
  );
}

function Part({ node }: { node: ChibiNode }) {
  return (
    <section id={`about-${node.id}`} aria-labelledby={`about-${node.id}-h`} className="scroll-mt-24">
      <p className="font-mono text-xs text-[var(--fg-muted)]">
        <span aria-hidden className="mr-1.5 text-[var(--accent)]">{node.glyph}</span>
        {node.tagline}
      </p>
      <h2 id={`about-${node.id}-h`} className="mt-1 text-xl font-semibold tracking-tight">
        {node.label}
      </h2>
      <p className="mt-3 leading-relaxed">{node.summary}</p>

      {node.flow && (
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[15px] leading-snug">
          {node.flow.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {node.stats.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {node.stats.map((s) => (
            <div key={s.label} className="glass px-3 py-2">
              <dt className="text-xs text-[var(--fg-muted)]">{s.label}</dt>
              <dd className="font-mono text-[var(--accent)]">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="mt-4 space-y-2.5">
        {node.branches.map((b) => (
          <div key={b.id}>
            <dt className="font-medium">{b.label}</dt>
            <dd className="text-[15px] leading-relaxed text-[var(--fg-muted)]">{b.body}</dd>
          </div>
        ))}
      </dl>

      {node.stack.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${node.label} stack`}>
          {node.stack.map((s) => (
            <li key={s} className="glass-chip px-2 py-0.5 font-mono text-[11px]">
              {s}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
