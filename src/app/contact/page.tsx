import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact/ContactForm';
import { ParticleField } from '@/components/ParticleField';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${site.fullName} - robotics and embedded systems engineer based in ${site.location}.`,
};

const LINKS = [
  { label: 'Email', value: site.email, href: `mailto:${site.email}` },
  { label: 'GitHub', value: '@Platinum-Saber', href: site.socials.github },
  ...(site.socials.linkedin
    ? [
        {
          label: 'LinkedIn',
          value: 'Connect on LinkedIn',
          href: site.socials.linkedin,
        },
      ]
    : []),
];

export default function ContactPage() {
  return (
    <div>
      {/* Phase 8.5 - rising streaks, quickening while a field has focus. The
          quickening is a `:has()` selector, not a listener: the form is
          untouched and it works with JavaScript disabled. */}
      <ParticleField mood="signal" />
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p
        className="mt-3 max-w-xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        Open to internships, research collaborations and interesting robotics
        problems. Email is the fastest way to reach me.
      </p>

      <div className="mt-9 max-w-xl">
        <ContactForm />
      </div>

      {/*
        Kept deliberately, not left over. The form's every failure path ends in
        a mailto: link, and this list is the same promise made statically - it
        is in the HTML whether or not JavaScript runs, whether or not Supabase
        exists. Do not remove it to tidy up the page.
      */}
      <h2
        className="mt-16 text-sm font-semibold tracking-widest uppercase"
        style={{ color: 'var(--fg-muted)' }}
      >
        Or reach me directly
      </h2>

      <dl className="mt-6 space-y-5">
        {LINKS.map(({ label, value, href }) => (
          <div
            key={label}
            className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6"
          >
            <dt
              className="font-mono text-xs tracking-wide uppercase sm:w-24 sm:shrink-0"
              style={{ color: 'var(--fg-muted)' }}
            >
              {label}
            </dt>
            <dd>
              <a
                href={href}
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {value}
              </a>
            </dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
          <dt
            className="font-mono text-xs tracking-wide uppercase sm:w-24 sm:shrink-0"
            style={{ color: 'var(--fg-muted)' }}
          >
            Location
          </dt>
          <dd>{site.location}</dd>
        </div>
      </dl>
    </div>
  );
}
