import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/notes/auth';

export const dynamic = 'force-dynamic';

/**
 * POST only. A GET sign-out could be triggered by any <img src> on any site;
 * the form on the notes pages posts here, and SameSite=Lax keeps a cross-site
 * POST from carrying the cookie anyway.
 */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(
    new URL('/notes/login?signedout=1', req.url),
    303,
  );
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
