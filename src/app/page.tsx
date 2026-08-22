import Link from 'next/link';
import { getFeaturedProjects } from '@/lib/projects';
import { ProjectCard } from '@/components/ProjectCard';
import { site } from '@/lib/site';

export default function HomePage() {
  const featured = getFeaturedProjects();

  return (
    <div className="space-y-16">
      {/*
        Phase 2 note: the 3D hero canvas mounts *above* this section and lazy-loads.
        This text must always render first and stand on its own with WebGL disabled.
      */}
      <section>
        <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
          {site.location}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {site.fullName}
        </h1>
        <p
          className="mt-4 text-lg leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          I build robots and the hardware they run on. Currently an
          undergraduate at the University of Moratuwa, working on an autonomous
          drone platform for my final year project and a multi-robot SLAM system
          that gets two scouts to agree on one map.
        </p>
        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          My work sits where embedded systems meet perception — ROS 2 and Jetson
          on one side, Verilog and VHDL on an FPGA on the other. I like the
          problems that only appear once the thing is real: clock domains that
          disagree, frames that drift, mass budgets that arbitrate every
          argument.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--fg)', color: 'var(--bg)' }}
          >
            View projects
          </Link>
          {/*
            The invitation, not the front door. This page stays text-first and
            loads no three.js — see the Decision Log. Anyone who wants the
            other version is one click away, and nobody is made to fly.
          */}
          <Link
            href="/explore"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Or fly through it →
          </Link>
          <a
            href={site.socials.github}
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
          >
            GitHub
          </a>
          <Link
            href="/contact"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
          >
            Get in touch
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: 'var(--fg-muted)' }}
          >
            Selected work
          </h2>
          <Link
            href="/projects"
            className="text-sm hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            All projects →
          </Link>
        </div>
        <ul className="mt-5 space-y-3">
          {featured.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </ul>
      </section>
    </div>
  );
}
