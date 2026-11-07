'use client';

import { useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ALLOWED_DOMAIN, isAllowedEmail, safeNext } from '@/lib/notes/email';

/**
 * The sign-in card. Typing the address is a convenience and a first filter:
 * it gives instant feedback and is passed to Google as `login_hint`, so the
 * right account is preselected. It proves nothing - the callback checks the
 * address Google itself verified, with the same isAllowedEmail().
 */

const ERRORS: Record<string, string> = {
  domain: `That Google account is not on ${ALLOWED_DOMAIN}. Choose your department account, e.g. name.22@${ALLOWED_DOMAIN}.`,
  unverified:
    'Google did not report that address as verified, so it cannot be used.',
  cancelled: 'Sign-in was cancelled at Google.',
  expired:
    'The sign-in took too long or was finished in another browser. Try again.',
  state: 'The sign-in response did not match this browser. Try again.',
  google: 'Google could not complete the sign-in. Try again in a minute.',
  token: 'Google returned a response that could not be checked. Try again.',
  config: 'Sign-in is not configured on this deployment yet.',
};

export function LoginCard() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  // Set when Continue is pressed without a valid address: shows the hint box.
  const [blocked, setBlocked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // The page is static, so ?next / ?error are read on the client - via
  // useSyncExternalStore, so the server render and hydration agree (empty).
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => '',
  );
  const { next, error, signedOut } = useMemo(() => {
    const p = new URLSearchParams(search);
    const e = p.get('error');
    return {
      next: safeNext(p.get('next')),
      error: e ? (ERRORS[e] ?? 'Sign-in failed. Try again.') : null,
      signedOut: p.has('signedout'),
    };
  }, [search]);

  const valid = isAllowedEmail(email);
  const showInvalid = touched && email.length > 0 && !valid;

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!valid) {
      setBlocked(true);
      input.current?.focus();
      return;
    }
    setBlocked(false);
    setBusy(true);
    const q = new URLSearchParams({ next, hint: email.trim().toLowerCase() });
    // A full navigation, not router.push: this leaves the app for Google.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/notes/auth/google?${q}`);
  }

  return (
    <form className="nb-card nb-login-card" onSubmit={submit} noValidate>
      <h2 className="nb-h2">Sign in</h2>
      <p className="nb-muted">
        Open to CSE students and staff. Use your{' '}
        <strong>{ALLOWED_DOMAIN}</strong> Google account.
      </p>

      {error && (
        <p className="nb-alert nb-alert-error" role="alert">
          {error}
        </p>
      )}
      {signedOut && !error && (
        <p className="nb-alert" role="status">
          You are signed out.
        </p>
      )}

      <label htmlFor={`${id}-email`} className="nb-label">
        Department email
      </label>
      <input
        id={`${id}-email`}
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        placeholder={`name.22@${ALLOWED_DOMAIN}`}
        className="nb-input"
        ref={input}
        value={email}
        aria-invalid={showInvalid || undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setEmail(e.target.value);
          if (blocked && isAllowedEmail(e.target.value)) setBlocked(false);
        }}
        onBlur={() => setTouched(true)}
      />
      <p
        id={`${id}-hint`}
        className={showInvalid ? 'nb-field-hint nb-field-bad' : 'nb-field-hint'}
        aria-live="polite"
      >
        {showInvalid
          ? `Only @${ALLOWED_DOMAIN} addresses can sign in.`
          : valid
            ? '✓ Department address'
            : `Must end in @${ALLOWED_DOMAIN}`}
      </p>

      {blocked && (
        <div className="nb-alert nb-alert-hint" role="alert">
          <span aria-hidden="true">✋</span>
          <span>
            <b>
              {email.trim()
                ? 'That is not a department address.'
                : 'Enter your department email first.'}
            </b>
            Sign-in is open to <strong>@{ALLOWED_DOMAIN}</strong> accounts only,
            for example <code>name.22@{ALLOWED_DOMAIN}</code>. Google then asks
            you to confirm it.
          </span>
        </div>
      )}

      <button
        type="submit"
        className="nb-btn nb-btn-primary nb-btn-block"
        disabled={busy}
      >
        <GoogleMark />
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <p className="nb-fine">
        Your address is checked again after Google confirms it. The site keeps
        no account: a signed cookie holds your session for seven days.{' '}
        <a href="/notes/privacy" className="nb-link">
          Privacy
        </a>
      </p>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
