import type { Metadata } from 'next';
import Link from 'next/link';
import { AirframeExplorer } from '@/components/lab/AirframeExplorer';
import { DRONE_COMPONENTS, STATUS_LABEL } from '@/lib/drone';

export const metadata: Metadata = {
  title: 'Lab - Airframe Explorer',
  description:
    'An interactive 3D schematic of my final year project quadrotor - compute, perception, structure, propulsion and power, with specs, data paths and honest build status for each.',
};

export default function LabPage() {
  return (
    <div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        Lab
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Airframe Explorer
      </h1>
      <p
        className="mt-4 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        An interactive schematic of the quadrotor from my{' '}
        <Link
          href="/projects/autonomous-drone-platform"
          className="underline underline-offset-2"
          style={{ color: 'var(--accent)' }}
        >
          final year project
        </Link>
        . Orbit it, then select a marker to see what the component is, what it
        talks to, and whether it actually exists yet.
      </p>
      <p
        className="mt-3 max-w-2xl text-sm leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        The geometry is generated procedurally from primitives rather than
        loaded from a mesh file - it costs a few kilobytes instead of megabytes,
        and it stays editable as code while the real build changes. Read it as a
        schematic, not a render.
      </p>

      <div className="mt-9">
        <AirframeExplorer />
      </div>

      {/*
        The full reference, always in the HTML. This is what makes the page
        complete without WebGL, and what search engines actually index.
      */}
      <section className="mt-16">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Component reference
        </h2>

        <div className="mt-6 space-y-10">
          {DRONE_COMPONENTS.map((component, index) => (
            <article
              key={component.id}
              id={component.id}
              className="scroll-mt-20"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className="font-mono text-xs"
                  style={{ color: 'var(--accent)' }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="font-semibold">{component.name}</h3>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[11px]"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  {STATUS_LABEL[component.status]}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {component.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-4 border-b pb-1 text-sm"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <dt style={{ color: 'var(--fg-muted)' }}>{spec.label}</dt>
                    <dd className="font-mono text-xs">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              <h4
                className="mt-4 font-mono text-xs tracking-wide uppercase"
                style={{ color: 'var(--fg-muted)' }}
              >
                Connections
              </h4>
              <ul
                className="mt-2 space-y-1 text-sm"
                style={{ color: 'var(--fg-muted)' }}
              >
                {component.connections.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
                      ·
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <h4
                className="mt-4 font-mono text-xs tracking-wide uppercase"
                style={{ color: 'var(--fg-muted)' }}
              >
                Status
              </h4>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: 'var(--fg-muted)' }}
              >
                {component.statusNote}
              </p>
            </article>
          ))}
        </div>
      </section>

      <nav
        className="mt-16 flex flex-wrap gap-2.5 border-t pt-6 text-sm"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/projects/autonomous-drone-platform"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          Drone write-up
        </Link>
        <Link
          href="/lab/sobel"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          Sobel FPGA
        </Link>
        <Link
          href="/lab/ascilam"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          ASCILAM
        </Link>
        <Link
          href="/lab/keeper"
          className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
          style={{ color: 'var(--accent)' }}
        >
          Goal keeper
        </Link>
      </nav>
    </div>
  );
}
