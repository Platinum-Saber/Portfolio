import Link from 'next/link';
import type { Project } from '@/lib/projects';
import { StatusBadge } from './StatusBadge';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/projects/${project.slug}`}
        className="group block rounded-lg border p-5 transition-colors"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3
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
              className="rounded px-2 py-0.5 font-mono text-[11px]"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--fg-muted)',
              }}
            >
              {tech}
            </li>
          ))}
        </ul>
      </Link>
    </li>
  );
}
