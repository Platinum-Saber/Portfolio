import Link from 'next/link';

/** Breadcrumb + sign-out strip on every members-only notes page. */
export function NotesBar({
  crumbs,
}: {
  crumbs: { href?: string; label: string }[];
}) {
  return (
    <div className="nb-bar">
      <nav aria-label="Breadcrumb">
        <ol className="nb-crumbs">
          <li>
            <Link href="/" className="nb-link">
              sansikawaduge.dev
            </Link>
          </li>
          {crumbs.map((c, i) => (
            <li key={i}>
              {c.href ? (
                <Link href={c.href} className="nb-link">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <form action="/api/notes/auth/logout" method="post">
        <button type="submit" className="nb-btn nb-btn-sm nb-btn-ghost">
          Sign out
        </button>
      </form>
    </div>
  );
}
