/**
 * Who counts as a department address, and where a login may send you back to.
 * Pure functions, no secrets - shared by the server (which enforces them) and
 * the login form (which only uses them for instant feedback).
 */

/** The department's mail domain. Subdomains (x@lab.cse.mrt.ac.lk) also pass. */
export const ALLOWED_DOMAIN = 'cse.mrt.ac.lk';

const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/;

/**
 * True for `sansika.22@cse.mrt.ac.lk`, false for `x@gmail.com`,
 * `x@mrt.ac.lk`, `x@notcse.mrt.ac.lk` and `x@cse.mrt.ac.lk.evil.com`.
 * This is the rule the server enforces; the login form runs the same function
 * only to give instant feedback.
 */
export function isAllowedEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at !== email.indexOf('@')) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!LOCAL_PART.test(local) || local.includes('..')) return false;
  if (domain === ALLOWED_DOMAIN) return true;
  if (!domain.endsWith(`.${ALLOWED_DOMAIN}`)) return false;
  const sub = domain.slice(0, -(ALLOWED_DOMAIN.length + 1));
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(sub);
}

/**
 * Where to send someone after sign-in. Only paths inside the notes section,
 * and never a protocol-relative `//evil.com` - an open redirect on a login
 * flow is a phishing kit.
 */
export function safeNext(raw: string | null | undefined): string {
  const fallback = '/notes/cse';
  if (!raw) return fallback;
  if (!raw.startsWith('/notes/') || raw.startsWith('//') || raw.includes('\\'))
    return fallback;
  try {
    const u = new URL(raw, 'https://x.invalid');
    if (u.origin !== 'https://x.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
