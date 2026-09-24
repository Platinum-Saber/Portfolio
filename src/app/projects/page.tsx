import type { Metadata } from 'next';
import { getAllProjects } from '@/lib/projects';
import { ProjectCard } from '@/components/ProjectCard';
import { ParticleField } from '@/components/ParticleField';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Robotics, embedded systems and backend engineering projects - autonomous drones, multi-robot SLAM, FPGA design and low-latency market data.',
};

export default function ProjectsPage() {
  const projects = getAllProjects();
  const domains = [...new Set(projects.map((p) => p.domain))];

  return (
    <div>
      {/* Index - a lattice, not a drift. The case studies themselves get no
          field at all; that exclusion is a non-negotiable in §5.2. */}
      <ParticleField mood="index" />

      <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
      <p
        className="mt-3 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        Ordered roughly by how much of my attention they currently hold.
        Robotics and embedded work leads; the backend work is there because
        production systems taught me things coursework couldn&apos;t.
      </p>

      {domains.map((domain) => (
        <section key={domain} className="mt-12">
          <h2
            className="rise text-sm font-semibold tracking-widest uppercase"
            style={{ color: 'var(--fg-muted)' }}
          >
            {domain}
          </h2>
          <ul className="mt-4 space-y-3">
            {projects
              .filter((p) => p.domain === domain)
              .map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
