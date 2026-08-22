import type { Metadata } from 'next';
import Link from 'next/link';
import { Explorer } from '@/components/explore/Explorer';
import { buildZones } from '@/lib/explore/zones';
import { getAllProjects } from '@/lib/projects';
import { SKILL_GROUPS } from '@/lib/skills';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Explore — fly through the portfolio',
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
        nothing is hidden behind being good at it — every one is a click away in
        the list underneath, and all of it is written out in plain text below.
      </p>

      <div className="mt-9">
        <Explorer zones={zones} />
      </div>

      <section className="mt-16 max-w-2xl">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Controls
        </h2>
        <dl className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[
            ['W / S', 'forward and back'],
            ['A / D', 'strafe left and right'],
            ['↑ / ↓ or space / shift', 'climb and descend'],
            ['← / →', 'yaw'],
            ['Left stick (touch)', 'throttle and yaw'],
            ['Right stick (touch)', 'pitch and roll'],
          ].map(([keys, action]) => (
            <div
              key={keys}
              className="flex justify-between gap-4 border-b pb-1 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <dt className="font-mono text-xs">{keys}</dt>
              <dd className="text-right" style={{ color: 'var(--fg-muted)' }}>
                {action}
              </dd>
            </div>
          ))}
        </dl>
        <p
          className="mt-4 text-sm leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          The touch sticks are laid out Mode 2, the way a real transmitter is —
          throttle and yaw on the left, pitch and roll on the right. It cost
          nothing to get right and it is the layout anyone who has flown a quad
          already has in their hands.
        </p>
      </section>

      {/*
        Everything in the world, as ordinary HTML. This is not a fallback bolted
        on afterwards — it is the same `zones` array the canvas renders, so the
        two cannot disagree. A recruiter with WebGL disabled, a screen reader,
        and a search crawler all get the whole thing.
      */}
      <section className="mt-16">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Everything in the world
        </h2>

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
                      className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--fg-muted)',
                      }}
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
                    className="text-sm hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    Read the full version →
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <nav
        className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          ← Back to the readable version
        </Link>
        <Link
          href="/lab"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Lab →
        </Link>
      </nav>
    </div>
  );
}
