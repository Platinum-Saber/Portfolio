import type { Metadata } from 'next';
import { ConsoleCard, ConsoleField } from '@/components/ConsoleCard';
import { Portrait } from '@/components/Portrait';
import Link from 'next/link';
import { EXPERIENCE } from '@/lib/experience';
import { EXTENDED, IDENTITY, SUMMARY } from '@/lib/operator';
import { SKILL_GROUPS } from '@/lib/skills';
import { site } from '@/lib/site';
import { ParticleField } from '@/components/ParticleField';

export const metadata: Metadata = {
  title: 'About',
  description: site.description,
};

export default function AboutPage() {
  return (
    <div>
      {/* Calm - near-still motes, per the mood table. `/about` is the one
          content route whose field does not travel. */}
      <ParticleField mood="calm" />

      <h1 className="text-3xl font-semibold tracking-tight">About</h1>

      {/*
        The full dossier - the same primitive and the same source as the
        summary on `/`, extended rather than restated. Two cards carrying
        overlapping-but-different values would be worse than one card and
        a link, which is why both read from `lib/operator.ts`.
      */}
      <div className="mt-6 max-w-2xl">
        <ConsoleCard
          title="Operator"
          meta="Full dossier"
          portrait={<Portrait size={128} />}
        >
          {[...IDENTITY, ...SUMMARY, ...EXTENDED].map((field) => (
            <ConsoleField key={field.label} label={field.label}>
              {field.value}
            </ConsoleField>
          ))}
        </ConsoleCard>
      </div>

      <div
        className="mt-10 space-y-5 leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        <p>
          I&apos;m {site.fullName}, an embedded systems engineer and
          undergraduate at the University of Moratuwa, based in {site.location}.
          I build the hardware layer first - FPGA logic, microcontroller
          firmware, sensor interfaces - then the robots and software that run on
          it.
        </p>
        <p>
          On the hardware side I have built a 4-bit processor in VHDL and a
          Sobel edge detector in Verilog that outputs one pixel per clock. Above
          that sits robotics: LiDAR scouts that share one map over micro-ROS,
          and a Jetson Orin Nano at the centre of my final year drone. Working
          both layers has made me suspicious of abstractions I haven&apos;t
          looked underneath at least once.
        </p>
        <p>
          I also write production software. For six months I was an intern
          software engineer at GTN Technologies, building Java and Spring Boot
          services on Kafka and Redis that keep live market data accurate for a
          global trading platform. It taught me to measure before optimising and
          to distrust my instincts about where time actually goes.
        </p>
        <p>
          My coursework spans embedded systems, robotics, machine learning, HCI
          and software engineering. Outside it I spend time on computer
          graphics, computer vision and CTF-style security problems.
        </p>
      </div>

      <section className="mt-12">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Experience
        </h2>
        <ol className="mt-5 space-y-10">
          {EXPERIENCE.map((job) => (
            <li key={`${job.company}-${job.period}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-medium">
                  {job.role} ·{' '}
                  <span style={{ color: 'var(--accent)' }}>{job.company}</span>
                </h3>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'var(--fg-muted)' }}
                >
                  {job.period}
                </span>
              </div>
              <p
                className="mt-1 font-mono text-xs"
                style={{ color: 'var(--fg-muted)' }}
              >
                {job.team} · {job.location}
              </p>
              <p
                className="mt-3 leading-relaxed"
                style={{ color: 'var(--fg-muted)' }}
              >
                {job.summary}
              </p>
              <ul className="mt-4 space-y-3">
                {job.work.map((item) => (
                  <li
                    key={item.title}
                    className="border-l pl-4"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p
                      className="mt-1 text-sm leading-relaxed"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {job.stack.map((tech) => (
                  <li
                    key={tech}
                    className="rounded px-2 py-1 font-mono text-[11px]"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--fg-muted)',
                    }}
                  >
                    {tech}
                  </li>
                ))}
              </ul>
              {job.caseStudy && (
                <p className="mt-4 text-sm">
                  <Link
                    href={job.caseStudy}
                    className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    More on this work
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Tools I reach for
        </h2>
        <dl className="mt-5 space-y-6">
          {SKILL_GROUPS.map(({ group, items }) => (
            <div key={group}>
              <dt className="text-sm font-medium">{group}</dt>
              <dd className="mt-2">
                <ul className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="rounded px-2 py-1 font-mono text-[11px]"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--fg-muted)',
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {site.cv && (
        <section className="mt-12">
          <h2
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color: 'var(--fg-muted)' }}
          >
            CV
          </h2>
          <p className="mt-3">
            <a
              href={site.cv}
              className="glass glass-btn glass-press inline-flex items-center gap-2 px-3.5 py-1.5"
              style={{ color: 'var(--accent)' }}
            >
              Download CV
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
