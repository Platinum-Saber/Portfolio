import { NextResponse, type NextRequest } from 'next/server';
import {
  ALLOWED_DOMAIN,
  OAUTH_COOKIE,
  OAUTH_TTL_S,
  authSecret,
  cookieSecure,
  isAllowedEmail,
  pkceChallenge,
  randomToken,
  safeNext,
  sign,
} from '@/lib/notes/auth';
import { CALLBACK_PATH, GOOGLE_AUTH, googleConfig } from '@/lib/notes/google';

export const dynamic = 'force-dynamic';

/** Step 1: send the visitor to Google, restricted to the department's Workspace. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));
  const config = googleConfig();
  const secret = authSecret();
  if (!config || !secret) {
    return NextResponse.redirect(
      new URL(
        `/notes/login?error=config&next=${encodeURIComponent(next)}`,
        url,
      ),
      303,
    );
  }

  const state = randomToken();
  const verifier = randomToken(48);
  const exp = Math.floor(Date.now() / 1000) + OAUTH_TTL_S;
  const cookie = await sign('oauth', { state, verifier, next, exp }, secret);

  const auth = new URL(GOOGLE_AUTH);
  auth.searchParams.set('client_id', config.clientId);
  auth.searchParams.set('redirect_uri', new URL(CALLBACK_PATH, url).toString());
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email profile');
  // `hd` makes Google's account chooser show only Workspace accounts on the
  // domain. It is a UI hint, not a check - the callback enforces the rule.
  auth.searchParams.set('hd', ALLOWED_DOMAIN);
  auth.searchParams.set('prompt', 'select_account');
  auth.searchParams.set('state', state);
  auth.searchParams.set('code_challenge', await pkceChallenge(verifier));
  auth.searchParams.set('code_challenge_method', 'S256');
  const hint = url.searchParams.get('hint');
  if (hint && isAllowedEmail(hint))
    auth.searchParams.set('login_hint', hint.trim().toLowerCase());

  const res = NextResponse.redirect(auth, 303);
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: cookieSecure(req.url),
    // Lax, not Strict: the callback is a top-level navigation FROM Google,
    // and Strict would withhold the cookie on exactly that request.
    sameSite: 'lax',
    path: '/api/notes/auth',
    maxAge: OAUTH_TTL_S,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
