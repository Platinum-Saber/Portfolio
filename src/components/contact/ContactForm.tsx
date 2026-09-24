'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LIMITS, validate, type FieldErrors } from '@/lib/contact/schema';
import { site } from '@/lib/site';

/**
 * The governing rule for this component: there is no failure state.
 *
 * Every path that is not "sent" ends with a mailto: link carrying whatever the
 * visitor already typed, so the worst outcome is one extra click in their own
 * mail client. Supabase paused, key rotated, project deleted, network dropped,
 * rate limited — all of it collapses to the same calm sentence and the same
 * link. A contact form that can lose someone's message is worse than no form.
 */

type State =
  | { kind: 'editing' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'fallback'; note: string };

function mailtoHref(draft: { name: string; email: string; message: string }) {
  const subject = draft.name
    ? `Portfolio enquiry — ${draft.name}`
    : 'Portfolio enquiry';
  const body = draft.message
    ? `${draft.message}\n\n— ${draft.name || 'sent from the portfolio contact form'}${
        draft.email ? `\n${draft.email}` : ''
      }`
    : '';
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm() {
  const fieldId = useId();
  const [draft, setDraft] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<State>({ kind: 'editing' });
  const [honeypot, setHoneypot] = useState('');

  // When the visitor first saw the form. The server compares this against a
  // floor to weed out instant submissions. See the route handler for why this
  // is worth doing and why it is not a security control.
  //
  // Stamped in an effect rather than in `useRef(Date.now())`: reading the clock
  // during render is impure, and on a prerendered page it would be the build
  // time rather than the visit. Null until mount, which the submit handler
  // treats as "no measurement", so the check can only ever fail open.
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const update = (field: keyof typeof draft) => (value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === 'sending') return;

    const found = validate(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setState({ kind: 'sending' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          website: honeypot,
          // Omitted entirely rather than sent as null when unmeasured — the
          // route only judges an actual number, and this keeps the wire
          // format saying what it means.
          ...(openedAt.current === null
            ? {}
            : { elapsedMs: Date.now() - openedAt.current }),
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (response.ok) {
        setState({ kind: 'sent' });
        return;
      }

      if (response.status === 422) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: FieldErrors;
        } | null;
        setErrors(payload?.errors ?? {});
        setState({ kind: 'editing' });
        return;
      }

      if (response.status === 429) {
        setState({
          kind: 'fallback',
          note: 'That is a few messages in quick succession, so the form has paused. Email works immediately and reaches exactly the same inbox.',
        });
        return;
      }

      setState({
        kind: 'fallback',
        note: 'The form could not reach its database just now. Nothing is lost — the button below opens your mail app with everything you wrote already in it.',
      });
    } catch {
      setState({
        kind: 'fallback',
        note: 'The request did not get through — that is usually the network rather than you. The button below opens your mail app with everything you wrote already in it.',
      });
    }
  }

  if (state.kind === 'sent') {
    return (
      <div
        className="glass p-6"
        role="status"
      >
        <p className="font-medium">Sent — thank you.</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
          I read everything that arrives here and will reply to{' '}
          <span className="font-mono text-xs">{draft.email}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft({ name: '', email: '', message: '' });
            openedAt.current = Date.now();
            setState({ kind: 'editing' });
          }}
          className="mt-4 font-mono text-xs hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          ← send another
        </button>
      </div>
    );
  }

  const sending = state.kind === 'sending';

  // 9.0d: fields are glass wells (`.glass-field`); only the text colour is set here.
  const inputStyle = { color: 'var(--fg)' };

  const fields = [
    {
      key: 'name' as const,
      label: 'Name',
      type: 'text',
      autoComplete: 'name',
      maxLength: LIMITS.name.max,
    },
    {
      key: 'email' as const,
      label: 'Email',
      type: 'email',
      autoComplete: 'email',
      maxLength: LIMITS.email.max,
    },
  ];

  return (
    <div>
      {state.kind === 'fallback' && (
        <div
          className="glass mb-6 p-5"
          role="status"
        >
          <p className="text-sm leading-relaxed">{state.note}</p>
          <a
            href={mailtoHref(draft)}
            className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
          >
            Open this message in my mail app
          </a>
          <button
            type="button"
            onClick={() => setState({ kind: 'editing' })}
            className="mt-3 block font-mono text-xs hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            ← or try the form again
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {fields.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={`${fieldId}-${field.key}`}
              className="block font-mono text-xs tracking-wide uppercase"
              style={{ color: 'var(--fg-muted)' }}
            >
              {field.label}
            </label>
            <input
              id={`${fieldId}-${field.key}`}
              name={field.key}
              type={field.type}
              autoComplete={field.autoComplete}
              maxLength={field.maxLength}
              value={draft[field.key]}
              onChange={(event) => update(field.key)(event.target.value)}
              disabled={sending}
              aria-invalid={errors[field.key] ? true : undefined}
              aria-describedby={
                errors[field.key] ? `${fieldId}-${field.key}-error` : undefined
              }
              className="glass glass-field mt-2 w-full px-3 py-2 text-sm disabled:opacity-60"
              style={inputStyle}
            />
            {errors[field.key] && (
              <p
                id={`${fieldId}-${field.key}-error`}
                className="mt-2 text-xs"
                style={{ color: 'var(--accent)' }}
              >
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}

        <div>
          <label
            htmlFor={`${fieldId}-message`}
            className="block font-mono text-xs tracking-wide uppercase"
            style={{ color: 'var(--fg-muted)' }}
          >
            Message
          </label>
          <textarea
            id={`${fieldId}-message`}
            name="message"
            rows={6}
            maxLength={LIMITS.message.max}
            value={draft.message}
            onChange={(event) => update('message')(event.target.value)}
            disabled={sending}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={
              errors.message ? `${fieldId}-message-error` : undefined
            }
            className="glass glass-field mt-2 w-full resize-y px-3 py-2 text-sm disabled:opacity-60"
            style={inputStyle}
          />
          {errors.message && (
            <p
              id={`${fieldId}-message-error`}
              className="mt-2 text-xs"
              style={{ color: 'var(--accent)' }}
            >
              {errors.message}
            </p>
          )}
        </div>

        {/*
          The honeypot. Hidden from sight and from assistive technology, but a
          real focusable-free input that a form-filling bot will happily
          complete. Not `display: none` alone — some bots skip those.
        */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor={`${fieldId}-website`}>Website</label>
          <input
            id={`${fieldId}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={sending}
            // 9.0d: the page's primary action, in tinted glass.
            className="glass glass-btn glass-press glass-accent px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>
          <a
            href={mailtoHref(draft)}
            className="font-mono text-xs hover:underline"
            style={{ color: 'var(--fg-muted)' }}
          >
            or email me directly
          </a>
        </div>
      </form>

      <noscript>
        <p className="mt-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
          This form needs JavaScript to send. With it switched off,{' '}
          <a
            href={`mailto:${site.email}`}
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            {site.email}
          </a>{' '}
          reaches me directly — which is all the form does anyway.
        </p>
      </noscript>
    </div>
  );
}
