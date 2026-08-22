import type { Metadata } from 'next';
import { SKILL_GROUPS } from '@/lib/skills';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: site.description,
};

export default function AboutPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">About</h1>

      <div
        className="mt-6 space-y-5 leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        <p>
          I&apos;m {site.fullName}, an engineering undergraduate at the
          University of Moratuwa, based in {site.location}. My work is in
          robotics and embedded systems — building machines that perceive
          something about the world and act on it.
        </p>
        <p>
          Most of what I do sits across a boundary. On one side, ROS 2 and
          Jetson-class compute: multi-robot mapping, sensor fusion, autonomous
          navigation. On the other, the hardware underneath — processors and
          image pipelines written in Verilog and VHDL and synthesised onto an
          FPGA. Working both sides has made me suspicious of abstractions I
          haven&apos;t looked underneath at least once.
        </p>
        <p>
          Alongside that I&apos;ve worked on production market data
          infrastructure — low-latency VWAP computation in Redis Lua, Kafka
          pipelines, Spring Boot services. It&apos;s a different discipline from
          robotics, and a useful one: it taught me to profile before optimising
          and to distrust my instincts about where time actually goes.
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
              className="hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Download CV (PDF) →
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
