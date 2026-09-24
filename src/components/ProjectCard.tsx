import type { Project } from '@/lib/projects';
import { StatusBadge } from './StatusBadge';
import { TransitionLink } from './TransitionLink';

export function ProjectCard({ project }: { project: Project }) {
  return (
    // `rise` is Phase 8.4: a pure-CSS scroll-driven reveal, no-op where
    // `animation-timeline` is unsupported or motion is reduced.
    <li className="rise">
      <TransitionLink
        href={`/projects/${project.slug}`}
        // 9.0: a pane of pressable glass — takes the pointer light, lifts
        // toward it, gives under a press (`.glass-press` in globals.css).
        className="glass glass-press group block p-5"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* 8.3: morphs into the case study's <h1 data-vt-land>. */}
          <h3
            data-vt-morph
            className="text-base font-semibold group-hover:underline"
            style={{ color: 'var(--fg)' }}
          >
            {project.title}
          </h3>
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--fg-muted)' }}
          >
            {project.year}
          </span>
          <StatusBadge status={project.status} />
        </div>

        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          {project.summary}
        </p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {project.stack.slice(0, 5).map((tech) => (
            <li
              key={tech}
              className="glass glass-chip px-2 py-0.5 font-mono text-[11px]"
              style={{ color: 'var(--fg-muted)' }}
            >
              {tech}
            </li>
          ))}
        </ul>
      </TransitionLink>
    </li>
  );
}
