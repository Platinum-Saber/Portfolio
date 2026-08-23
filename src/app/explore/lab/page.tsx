import type { Metadata } from 'next';
import Link from 'next/link';
import { LabExplorer } from '@/components/explore/lab/LabExplorer';
import { STATIONS } from '@/lib/explore/lab';
import { buildZones } from '@/lib/explore/zones';
import { getAllProjects } from '@/lib/projects';
import { SKILL_GROUPS } from '@/lib/skills';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The lab — fly a drone around the workshop',
  description:
    'The portfolio as a room. Fly a small drone around a lab and read the projects off the console, the background off the cabinet and the contact details off the door.',
};

export default function LabRoomPage() {
  const projects = getAllProjects();

  // Same builder the outdoor world and the project pages use, so the room
  // cannot say something the site does not — and so every word below is in the
  // HTML whether or not the canvas ever runs.
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

  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const projectZones = zones.filter((zone) => zone.kind === 'project');

  return (
    <div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        Explore · lab
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Fly around the lab
      </h1>
      <p
        className="mt-4 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        A small drone, a room, and four things in it worth flying up to. The
        console along the far wall lists every project and opens any of them;
        the cabinet, the tank and the door hold the background, the tools and
        the way to reach me. You cannot fly through the walls, and nothing here
        is hidden behind being good at it — every station has a button under the
        canvas, and all of it is written out in plain text below.
      </p>

      <div className="mt-9">
        <LabExplorer zones={zones} />
      </div>

      {/*
        The room as ordinary HTML. Not a fallback bolted on afterwards: it is
        the same `zones` array the canvas reads, so the two cannot disagree.
      */}
      <details className="group mt-16">
        <summary
          className="cursor-pointer list-none text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Everything in the room
          <span
            className="ml-2 font-mono text-[11px] normal-case"
            style={{ color: 'var(--accent)' }}
          >
            <span className="group-open:hidden">show text version</span>
            <span className="hidden group-open:inline">hide</span>
          </span>
        </summary>

        <div className="mt-6 space-y-10">
          {STATIONS.map((station) => {
            const zone = station.zoneId
              ? zoneById.get(station.zoneId)
              : undefined;

            return (
              <article key={station.id} className="scroll-mt-20">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className="font-mono text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    {station.label}
                  </span>
                  <h3 className="font-semibold">
                    {zone ? zone.title : 'Every project'}
                  </h3>
                </div>

                {zone ? (
                  <>
                    {zone.body.map((paragraph) => (
                      <p
                        key={paragraph.slice(0, 24)}
                        className="mt-2 max-w-2xl text-sm leading-relaxed"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {paragraph}
                      </p>
                    ))}
                    {zone.href && (
                      <p className="mt-3">
                        <Link
                          href={zone.href}
                          className="text-sm hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          Read the full version →
                        </Link>
                      </p>
                    )}
                  </>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {projectZones.map((project) => (
                      <li key={project.id}>
                        <Link
                          href={project.href ?? `/projects/${project.id}`}
                          className="text-sm font-medium hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          {project.title}
                        </Link>
                        <p
                          className="mt-1 max-w-2xl text-sm leading-relaxed"
                          style={{ color: 'var(--fg-muted)' }}
                        >
                          {project.body[0]}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </details>

      <nav
        className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/explore"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          ← Out to the open world
        </Link>
        <Link
          href="/projects"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Projects →
        </Link>
      </nav>
    </div>
  );
}
