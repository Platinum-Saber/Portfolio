import { site } from '@/lib/site';

export function Footer() {
  return (
    <footer className="mt-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ color: 'var(--fg-muted)' }}
      >
        <p>
          © {new Date().getFullYear()} {site.fullName} · {site.location}
        </p>
        <div className="flex gap-4">
          <a href={site.socials.github} className="hover:underline">
            GitHub
          </a>
          {site.socials.linkedin && (
            <a href={site.socials.linkedin} className="hover:underline">
              LinkedIn
            </a>
          )}
          <a href={`mailto:${site.email}`} className="hover:underline">
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}
