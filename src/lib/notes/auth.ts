/**
 * Notes access control - who may read /notes/cse/*.
 *
 * Only members of the CSE department, proved by signing in with a Google
 * account whose verified address is on cse.mrt.ac.lk (the department runs on
 * Google Workspace). There is no user table: a successful sign-in mints a
 * signed, expiring cookie and that cookie is the whole session. Nothing here
 * touches Supabase, so the notes never depend on a project that pauses.
 *
 * Web Crypto only (no node:crypto), because the same code runs in the edge
 * middleware, in route handlers, and in workerd on Cloudflare.
 */

import { isAllowedEmail } from './email';
export { ALLOWED_DOMAIN, isAllowedEmail, safeNext } from './email';

export const SESSION_COOKIE = 'notes_session';
export const OAUTH_COOKIE = 'notes_oauth';
/** Seven days, as the reference site does: a week of revision, then sign in again. */
export const SESSION_TTL_S = 60 * 60 * 24 * 7;
export const OAUTH_TTL_S = 60 * 10;

// ---------------------------------------------------------------- tokens

export type Session = { email: string; name?: string; exp: number };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The signing secret. Missing or short = the notes stay locked, never open. */
export function authSecret(): string | null {
  const s = process.env.NOTES_AUTH_SECRET;
  return s && s.length >= 32 ? s : null;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** `<payload>.<sig>`, both base64url. `purpose` stops a cookie of one kind being replayed as the other. */
export async function sign(
  purpose: string,
  payload: object,
  secret: string,
): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${purpose}.${body}`),
  );
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verify<T extends { exp: number }>(
  purpose: string,
  token: string | undefined,
  secret: string,
): Promise<T | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot !== token.lastIndexOf('.')) return null;
  const body = token.slice(0, dot);
  try {
    const key = await hmacKey(secret);
    // crypto.subtle.verify is constant-time on the signature comparison.
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64url(token.slice(dot + 1)) as BufferSource,
      enc.encode(`${purpose}.${body}`),
    );
    if (!ok) return null;
    const data = JSON.parse(dec.decode(fromB64url(body))) as T;
    if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now())
      return null;
    return data;
  } catch {
    return null;
  }
}

export async function readSession(
  cookieValue: string | undefined,
): Promise<Session | null> {
  const secret = authSecret();
  if (!secret) return null;
  const s = await verify<Session>('session', cookieValue, secret);
  // Re-check the domain on every request, so tightening the rule above
  // locks out existing cookies too.
  return s && isAllowedEmail(s.email) ? s : null;
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** Cookies are Secure everywhere except plain-http localhost during `next dev`. */
export function cookieSecure(url: string): boolean {
  return new URL(url).protocol === 'https:';
}
