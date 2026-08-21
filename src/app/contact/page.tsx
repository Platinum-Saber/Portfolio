import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${site.fullName} — robotics and embedded systems engineer based in ${site.location}.`,
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
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p
        className="mt-3 max-w-xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        Open to internships, research collaborations and interesting robotics
        problems. Email is the fastest way to reach me.
      </p>

      {/*
        Phase 5 replaces this list with a real form backed by Supabase.
        Keep this markup as the fallback: if the form fails or the database is
        paused, it degrades to exactly this.
      */}
      <dl className="mt-9 space-y-5">
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
