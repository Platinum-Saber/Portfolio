import Link from 'next/link';
import { getFeaturedProjects } from '@/lib/projects';
import { ProjectCard } from '@/components/ProjectCard';
import { Chapter, Stage } from '@/components/Chapter';
import { ConsoleCard, ConsoleField } from '@/components/ConsoleCard';
import { HomePortal } from '@/components/HomePortal';
import { ParticleField } from '@/components/ParticleField';
import { Portrait } from '@/components/Portrait';
import { SUMMARY } from '@/lib/operator';
import { site } from '@/lib/site';

/**
 * The home page is a guided sequence — Phase 8.9.
 *
 * A consequence of stacking every chapter on one pinned surface: they are all
 * inside the viewport at all times, faded out or not, so Next prefetches every
 * link on the page at load. Measured, that put 53 KB on `/` for four routes
 * the visitor had not asked for. The lab links and the portal therefore carry
 * `prefetch={false}` — `/projects` keeps its prefetch, being both cheap and
 * the likely next stop.
 *
 * Five chapters, each pinned for about a screen: who this is, what he builds,
 * what he has built, what you can play with, and the door into the simulation.
 * The mechanics are in `Chapter.tsx` and `globals.css`; this file is only the
 * running order.
 *
 * There is no button row any more. The title bar carries Projects, About,
 * Contact and Explore from every page, and repeating them mid-page put three
 * competing exits in the middle of a narrative. What the page does carry is
 * the CV and the repo, in the operator card's footer, because those are the
 * two things a recruiter came for and neither is in the nav.
 */
export default function HomePage() {
  const featured = getFeaturedProjects();

  return (
    <>
      {/* Outside the stage: it is a fixed background, and being the stage's
          first child made it, not chapter one, match `:first-child`. */}
      <ParticleField mood="standby" />

      <Stage count={5}>
        <Chapter index={0} count={5}>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {site.fullName}
        </h1>
        <div className="mt-6 max-w-2xl">
          <ConsoleCard
            title="Operator"
            meta="Summary"
            portrait={<Portrait size={88} />}
            footer={
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {site.cv && (
                  <a
                    href={site.cv}
                    className="hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    CV (PDF) →
                  </a>
                )}
                <a
                  href={site.socials.github}
                  className="hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  GitHub →
                </a>
              </div>
            }
          >
            {SUMMARY.map((field) => (
              <ConsoleField key={field.label} label={field.label}>
                {field.value}
              </ConsoleField>
            ))}
          </ConsoleCard>
        </div>
      </Chapter>

      <Chapter index={1} count={5} label="What I build">
        <div className="max-w-2xl space-y-5 text-lg leading-relaxed">
          <p style={{ color: 'var(--fg)' }}>
            I build robots and the hardware they run on. Currently an
            undergraduate at the University of Moratuwa, working on an
            autonomous drone platform for my final year project and a
            multi-robot SLAM system that gets two scouts to agree on one map.
          </p>
          <p style={{ color: 'var(--fg-muted)' }}>
            My work sits where embedded systems meet perception — ROS 2 and
            Jetson on one side, Verilog and VHDL on an FPGA on the other. I like
            the problems that only appear once the thing is real: clock domains
            that disagree, frames that drift, mass budgets that arbitrate every
            argument.
          </p>
        </div>
      </Chapter>

      <Chapter index={2} count={5} label="Selected work">
        <div className="w-full">
          <ul className="space-y-3">
            {/* Three, not all of them: a chapter is one screen, and the
                next line is the way to the rest. */}
            {featured.slice(0, 3).map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </ul>
          <p className="mt-5">
            <Link
              href="/projects"
              className="text-sm hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              All projects →
            </Link>
          </p>
        </div>
      </Chapter>

      <Chapter index={3} count={5} label="The lab">
        <div className="max-w-2xl">
          <p className="mb-5 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            Three pieces you can operate rather than read about. Each runs in
            the browser, on its own route, and none of them loads until you ask.
          </p>
          <ConsoleCard title="Lab" meta="Interactive">
            <ConsoleField label="Airframe">
              <Link
                href="/lab"
                prefetch={false}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                The FYP quadrotor as a schematic →
              </Link>
            </ConsoleField>
            <ConsoleField label="Sobel">
              <Link
                href="/lab/sobel"
                prefetch={false}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Edge detection on your camera, in a shader →
              </Link>
            </ConsoleField>
            <ConsoleField label="ASCILAM">
              <Link
                href="/lab/ascilam"
                prefetch={false}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Two scouts, drift, and one fused map →
              </Link>
            </ConsoleField>
          </ConsoleCard>
        </div>
      </Chapter>

      <Chapter index={4} count={5} label="The other version">
        <HomePortal />
        </Chapter>
      </Stage>
    </>
  );
}
