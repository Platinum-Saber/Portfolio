/**
 * Google OpenID Connect, by hand - two redirects and one POST, which is less
 * code than configuring a library for it and adds nothing to the bundle.
 *
 * Authorization-code flow with PKCE and a signed state cookie. The ID token
 * arrives straight from Google's token endpoint over TLS, so per OIDC Core
 * §3.1.3.7 its claims can be validated without fetching Google's JWKS: we
 * still check iss, aud, exp and that the address is verified.
 */

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const CALLBACK_PATH = '/api/notes/auth/callback';

export type GoogleConfig = { clientId: string; clientSecret: string };

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export type IdClaims = {
  iss: string;
  aud: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
};

/** Decode the payload of a JWT that came directly from Google over TLS. */
export function decodeIdToken(idToken: string): IdClaims | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(
      parts[1].replace(/-/g, '+').replace(/_/g, '/') +
        '='.repeat((4 - (parts[1].length % 4)) % 4),
    );
    // atob gives Latin-1; names can be UTF-8.
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as IdClaims;
  } catch {
    return null;
  }
}

export function claimsProblem(
  c: IdClaims | null,
  clientId: string,
): string | null {
  if (!c) return 'token';
  if (
    c.iss !== 'https://accounts.google.com' &&
    c.iss !== 'accounts.google.com'
  )
    return 'token';
  if (c.aud !== clientId) return 'token';
  if (typeof c.exp !== 'number' || c.exp * 1000 < Date.now()) return 'token';
  if (!c.email || c.email_verified !== true) return 'unverified';
  return null;
}
