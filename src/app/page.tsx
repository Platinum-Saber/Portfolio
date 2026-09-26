import Link from 'next/link';
import { getFeaturedProjects } from '@/lib/projects';
import { TransitionLink } from '@/components/TransitionLink';
import { ProjectCard } from '@/components/ProjectCard';
import { Chapter, Stage } from '@/components/Chapter';
import { ConsoleCard, ConsoleField } from '@/components/ConsoleCard';
import { HomePortal } from '@/components/HomePortal';
import { ParticleField } from '@/components/ParticleField';
import { Portrait } from '@/components/Portrait';
import { SUMMARY } from '@/lib/operator';
import { site } from '@/lib/site';

/**
 * The home page is a guided sequence - Phase 8.9.
 *
 * A consequence of stacking every chapter on one pinned surface: they are all
 * inside the viewport at all times, faded out or not, so Next prefetches every
 * link on the page at load. Measured, that put 53 KB on `/` for four routes
 * the visitor had not asked for. The lab links and the portal therefore carry
 * `prefetch={false}` - `/projects` keeps its prefetch, being both cheap and
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
                <div className="flex flex-wrap gap-2.5 text-sm">
                  {site.cv && (
                    <a
                      href={site.cv}
                      className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                      style={{ color: 'var(--accent)' }}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                        <path d="M14 3v5h5" />
                        <path d="M12 11v6" />
                        <path d="m9 14 3 3 3-3" />
                      </svg>
                      CV
                    </a>
                  )}
                  <a
                    href={site.socials.github}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    GitHub
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
              I build systems that cross the boundary between code and hardware:
              FPGA pipelines in Verilog/VHDL, ESP32 and Raspberry Pi firmware,
              sensor-driven devices, and robots running ROS 2. I&apos;m drawn to
              problems where timing, perception, data movement, and control have
              to work together.
            </p>
            <p style={{ color: 'var(--fg-muted)' }}>
              My projects range from a Jetson Orin Nano drone and collaborative
              LiDAR mapping to a real-time FPGA Sobel edge detector, predictive
              goalkeeper, IoT medicine box, and market-data services in
              Java/Spring Boot. I also build full-stack applications, moving
              comfortably from device to backend.
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
              <TransitionLink
                href="/projects"
                className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5 text-sm"
                style={{ color: 'var(--accent)' }}
              >
                All projects
              </TransitionLink>
            </p>
          </div>
        </Chapter>

        <Chapter index={3} count={5} label="The lab">
          <div className="max-w-2xl">
            <p
              className="mb-5 leading-relaxed"
              style={{ color: 'var(--fg-muted)' }}
            >
              Three pieces you can operate rather than read about. Each runs in
              the browser, on its own route, and none of them loads until you
              ask.
            </p>
            <ConsoleCard
              title="Lab"
              meta="Interactive"
              lead={
                <div className="flex flex-wrap gap-2.5 text-sm">
                  <Link
                    href="/lab"
                    prefetch={false}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    Drone Frame
                  </Link>
                  <Link
                    href="/lab/sobel"
                    prefetch={false}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    Sobel FPGA
                  </Link>
                  <Link
                    href="/lab/ascilam"
                    prefetch={false}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    ASCILAM
                  </Link>
                  <Link
                    href="/lab/keeper"
                    prefetch={false}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    Goal keeper
                  </Link>
                </div>
              }
            />
          </div>
        </Chapter>

        <Chapter index={4} count={5} label="Flight Experience">
          <HomePortal />
        </Chapter>
      </Stage>
    </>
  );
}
