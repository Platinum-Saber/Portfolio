import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSession } from '@/lib/notes/auth';

/**
 * The notes gate. Runs ONLY on the matcher below - the rest of the site never
 * pays for it, and stays fully static.
 *
 * Why middleware.ts (edge) and not Next 16's proxy.ts: proxy.ts is Node-only,
 * and OpenNext's Cloudflare adapter flags Node middleware as experimental and
 * unmaintained. Edge middleware is the supported path on Workers.
 *
 * The pages behind it are still prerendered at build time. The gate decides
 * whether the prebuilt HTML / RSC payload is handed over; nothing renders on
 * request. That only protects content that lives in SERVER components - text
 * placed in a client component ships in a public /_next/static chunk. See
 * docs/NOTES.md.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Downloads (the full PDFs): always hand to the route handler, which does
  // its own session check. /notes-files is never served straight from the
  // asset store - wrangler.jsonc routes it to the Worker first.
  if (pathname.startsWith('/notes-files/')) {
    const url = req.nextUrl.clone();
    url.pathname = `/api/notes/files/${pathname.slice('/notes-files/'.length)}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === '/notes' || pathname === '/notes/') {
    return NextResponse.redirect(new URL('/notes/cse', req.url));
  }

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const login = new URL('/notes/login', req.url);
    login.searchParams.set('next', pathname + search);
    const res = NextResponse.redirect(login, 303);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const res = NextResponse.next();
  // Members-only pages must never sit in a shared cache, and never be indexed.
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/notes', '/notes/cse', '/notes/cse/:path*', '/notes-files/:path*'],
};
