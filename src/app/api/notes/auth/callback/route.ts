import { NextResponse, type NextRequest } from 'next/server';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_S,
  authSecret,
  cookieSecure,
  isAllowedEmail,
  safeNext,
  sign,
  verify,
} from '@/lib/notes/auth';
import {
  CALLBACK_PATH,
  GOOGLE_TOKEN,
  claimsProblem,
  decodeIdToken,
  googleConfig,
} from '@/lib/notes/google';

export const dynamic = 'force-dynamic';

type OAuthState = {
  state: string;
  verifier: string;
  next: string;
  exp: number;
};

/** Step 2: Google sends the visitor back with a code. Exchange it, check the address, mint the session. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const config = googleConfig();
  const secret = authSecret();

  const fail = (error: string, next = '/notes/cse') => {
    const res = NextResponse.redirect(
      new URL(
        `/notes/login?error=${error}&next=${encodeURIComponent(next)}`,
        url,
      ),
      303,
    );
    res.cookies.set(OAUTH_COOKIE, '', { path: '/api/notes/auth', maxAge: 0 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  if (!config || !secret) return fail('config');

  const saved = await verify<OAuthState>(
    'oauth',
    req.cookies.get(OAUTH_COOKIE)?.value,
    secret,
  );
  // No cookie: expired (10 min), or a different browser finished the flow.
  if (!saved) return fail('expired');
  const next = safeNext(saved.next);

  if (url.searchParams.get('error')) return fail('cancelled', next);
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== saved.state)
    return fail('state', next);

  let idToken: string | undefined;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: new URL(CALLBACK_PATH, url).toString(),
        grant_type: 'authorization_code',
        code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) {
      console.error(`[notes-auth] token exchange failed: ${tokenRes.status}`);
      return fail('google', next);
    }
    idToken = ((await tokenRes.json()) as { id_token?: string }).id_token;
  } catch (e) {
    console.error(`[notes-auth] token exchange threw: ${(e as Error).name}`);
    return fail('google', next);
  }

  const claims = idToken ? decodeIdToken(idToken) : null;
  const problem = claimsProblem(claims, config.clientId);
  if (problem) return fail(problem, next);
  const email = claims!.email!.toLowerCase();
  if (!isAllowedEmail(email)) return fail('domain', next);

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const session = await sign(
    'session',
    { email, name: claims!.name, exp },
    secret,
  );

  const res = NextResponse.redirect(new URL(next, url), 303);
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: cookieSecure(req.url),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_S,
  });
  res.cookies.set(OAUTH_COOKIE, '', { path: '/api/notes/auth', maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
