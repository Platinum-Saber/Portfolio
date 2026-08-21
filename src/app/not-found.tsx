import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-16">
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3" style={{ color: 'var(--fg-muted)' }}>
        That page doesn&apos;t exist — it may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block hover:underline"
        style={{ color: 'var(--accent)' }}
      >
        Back home →
      </Link>
    </div>
  );
}
