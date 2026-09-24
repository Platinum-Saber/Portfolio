import type { Metadata } from 'next';
import Link from 'next/link';
import { Explorer } from '@/components/explore/Explorer';
import { buildZones } from '@/lib/explore/zones';
import { getAllProjects } from '@/lib/projects';
import { SKILL_GROUPS } from '@/lib/skills';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Explore - fly through the portfolio',
  description:
    'The same portfolio, as somewhere to fly. Pilot a drone around a wireframe world and the projects, background and contact details appear as you reach them.',
};

export default function ExplorePage() {
  const projects = getAllProjects();

  // Built on the server from the same MDX frontmatter the project pages read,
  // so the world cannot say something the site does not. It also means every
  // word below is in the HTML for anyone who never runs the canvas at all.
  const zones = buildZones(
    projects.map((project) => ({
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      year: project.year,
      stack: project.stack,
      domain: project.domain,
    })),
    {
      fullName: site.fullName,
      location: site.location,
      email: site.email,
      tagline: site.tagline,
    },
    SKILL_GROUPS,
  );

  return (
    <div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        Explore
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Fly through it
      </h1>
      <p
        className="mt-4 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        The same portfolio, arranged as somewhere to fly rather than something
        to scroll. Take the controls and the projects, the background and the
        contact details are out there waiting to be reached. Nine markers, and
        nothing is hidden behind being good at it - every one is a click away in
        the list underneath, and all of it is written out in plain text below.
      </p>

      <div className="mt-9">
        <Explorer zones={zones} />
      </div>

      {/*
        Everything in the world, as ordinary HTML. This is not a fallback bolted
        on afterwards - it is the same `zones` array the canvas renders, so the
        two cannot disagree. A recruiter with WebGL disabled, a screen reader,
        and a search crawler all get the whole thing.

        Collapsed rather than removed. It was crowding the page under a world
        that now fills most of the screen, but deleting it would take the
        no-WebGL path and the indexable text with it. A <details> is closed by
        default and still ships every word in the HTML.
      */}
      <details className="group mt-16">
        <summary
          className="cursor-pointer list-none text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Everything in the world
          <span
            className="ml-2 font-mono text-[11px] normal-case"
            style={{ color: 'var(--accent)' }}
          >
            <span className="group-open:hidden">show text version</span>
            <span className="hidden group-open:inline">hide</span>
          </span>
        </summary>

        <div className="mt-6 space-y-10">
          {zones.map((zone) => (
            <article
              key={zone.id}
              id={`zone-${zone.id}`}
              className="scroll-mt-20"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className="font-mono text-xs"
                  style={{ color: 'var(--accent)' }}
                >
                  {zone.short}
                </span>
                <h3 className="font-semibold">{zone.title}</h3>
              </div>

              {zone.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="mt-2 max-w-2xl text-sm leading-relaxed"
                  style={{ color: 'var(--fg-muted)' }}
                >
                  {paragraph}
                </p>
              ))}

              {zone.tags && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {zone.tags.map((tag) => (
                    <li
                      key={tag}
                      className="glass glass-chip px-1.5 py-0.5 font-mono text-[10px]"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}

              {zone.href && (
                <p className="mt-3">
                  <Link
                    href={zone.href}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5 text-sm"
                    style={{ color: 'var(--accent)' }}
                  >
                    Full version
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>
      </details>

      <nav
        className="mt-16 flex flex-wrap gap-2.5 border-t pt-6 text-sm"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          Readable version
        </Link>
        <Link
          href="/explore/lab"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          Inside the lab
        </Link>
        <Link
          href="/lab"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          Drone Frame
        </Link>
      </nav>
    </div>
  );
}
