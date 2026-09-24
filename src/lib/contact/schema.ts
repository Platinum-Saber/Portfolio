/**
 * One validator, used by both the form and the route handler.
 *
 * Hand-rolled rather than zod: this is four fields, the rules have to match the
 * SQL CHECK constraints in `supabase/migrations/0001_contacts.sql` exactly, and
 * writing them out makes that correspondence visible. Adding a dependency to
 * express `length between 1 and 120` would be the more fashionable choice and
 * the worse one.
 */

export const LIMITS = {
  name: { min: 1, max: 120 },
  email: { min: 3, max: 254 },
  message: { min: 10, max: 5000 },
} as const;

/** How long a human plausibly takes to fill this in. Bots post instantly. */
export const MIN_FILL_MS = 2500;

export type ContactDraft = {
  name: string;
  email: string;
  message: string;
};

export type FieldErrors = Partial<Record<keyof ContactDraft, string>>;

/**
 * Deliberately permissive. The only question worth asking of an address here is
 * "could this plausibly be delivered to" - anything stricter rejects real
 * people, and the real check is whether a reply bounces.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validate(draft: ContactDraft): FieldErrors {
  const errors: FieldErrors = {};

  const name = draft.name.trim();
  if (name.length < LIMITS.name.min) {
    errors.name = 'Please tell me who you are.';
  } else if (name.length > LIMITS.name.max) {
    errors.name = `That is longer than ${LIMITS.name.max} characters.`;
  }

  const email = draft.email.trim();
  if (email.length === 0) {
    errors.email = 'I need an address to reply to.';
  } else if (email.length > LIMITS.email.max || !EMAIL.test(email)) {
    errors.email = 'That does not look like an email address.';
  }

  const message = draft.message.trim();
  if (message.length < LIMITS.message.min) {
    errors.message = `A little more detail - at least ${LIMITS.message.min} characters.`;
  } else if (message.length > LIMITS.message.max) {
    errors.message = `That is over ${LIMITS.message.max} characters. Send a summary and we can go deeper by email.`;
  }

  return errors;
}

export function normalise(draft: ContactDraft): ContactDraft {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    message: draft.message.trim(),
  };
}
