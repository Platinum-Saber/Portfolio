import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllProjects, getProject, getProjectSlugs } from '@/lib/projects';
import { StatusBadge } from '@/components/StatusBadge';
import { TransitionLink } from '@/components/TransitionLink';

type Params = { params: Promise<{ slug: string }> };

// Only the slugs that exist at build time. An unknown slug is a 404 from the
// prebuilt output, never a render on request — on Cloudflare the Worker has
// no filesystem to read content/projects from (docs/DEPLOY-CLOUDFLARE.md).
export const dynamicParams = false;

export function generateStaticParams() {
  return getProjectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    openGraph: {
      title: project.title,
      description: project.summary,
      type: 'article',
    },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const all = getAllProjects();
  const index = all.findIndex((p) => p.slug === slug);
  const next = all[index + 1];

  return (
    <article>
      {/*
        Reading-progress rail — Phase 8.4. Chrome, not content: it is
        `aria-hidden`, it scrubs with the document's scroll position, and it
        is the ONLY animated thing on a case study. The prose is never
        scrubbed, revealed or parallaxed — this is the page someone came to
        read.
      */}
      <div
        aria-hidden="true"
        className="scroll-rail fixed inset-x-0 top-0 z-50 h-0.5"
        style={{ backgroundColor: 'var(--accent)' }}
      />
      <TransitionLink
        href="/projects"
        className="font-mono text-sm hover:underline"
        style={{ color: 'var(--fg-muted)' }}
      >
        ← Projects
      </TransitionLink>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--accent)' }}
          >
            {project.domain}
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--fg-muted)' }}
          >
            {project.year}
          </span>
          <StatusBadge status={project.status} />
        </div>

        {/* 8.3: the landing element for a card title's morph. */}
        <h1
          data-vt-land
          className="mt-3 w-fit text-3xl font-semibold tracking-tight"
        >
          {project.title}
        </h1>
        <p
          className="mt-3 text-lg leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          {project.summary}
        </p>

        <ul className="mt-5 flex flex-wrap gap-1.5">
          {project.stack.map((tech) => (
            <li
              key={tech}
              className="glass glass-chip px-2 py-1 font-mono text-[11px]"
              style={{ color: 'var(--fg-muted)' }}
            >
              {tech}
            </li>
          ))}
        </ul>

        {(project.repo || project.demo || project.writeup) && (
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            {project.repo && (
              <a
                href={project.repo}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Source code →
              </a>
            )}
            {project.demo && (
              <a
                href={project.demo}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Live demo →
              </a>
            )}
            {project.writeup && (
              <a
                href={project.writeup}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Full write-up →
              </a>
            )}
          </div>
        )}
      </header>

      <hr className="my-9" style={{ borderColor: 'var(--border)' }} />

      <div className="prose prose-site prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-xl prose-h3:text-base prose-a:underline-offset-2 max-w-none">
        <MDXRemote source={project.body} />
      </div>

      {next && (
        <nav
          className="mt-16 border-t pt-6"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
            Next
          </p>
          <TransitionLink
            href={`/projects/${next.slug}`}
            data-vt-morph
            className="mt-1 block w-fit text-lg font-medium hover:underline"
          >
            {next.title}
          </TransitionLink>
        </nav>
      )}
    </article>
  );
}
