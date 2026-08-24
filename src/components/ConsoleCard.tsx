import type { ReactNode } from 'react';

/**
 * The console card — Phase 8.2.
 *
 * One primitive behind every labelled-field block on the site: the home
 * summary, the About dossier, and (Phase 9) the explore zone panels and lab
 * callouts. It exists so those four stop being four different-looking boxes.
 *
 * Anatomy: mono uppercase label · dotted leader · value, inside a 1px frame
 * with a chrome header. Borders and spacing carry the schematic language —
 * no shadow, no gradient, no glass, in either theme.
 *
 * Two rules it enforces rather than documents:
 *   1. `meta` is decoration and is hidden from assistive tech. Version
 *      strings and ID noise are texture; a screen reader gets the fields.
 *   2. A field with a null value renders nothing at all. Same convention as
 *      `site.cv` and `site.socials.linkedin` — the card never shows a row
 *      with an invented value in it, and never shows an empty one either.
 */
export function ConsoleCard({
  title,
  meta,
  portrait,
  children,
  footer,
}: {
  /** Read aloud. Says what this card is: 'OPERATOR', 'ZONE', 'COMPONENT'. */
  title: string;
  /** Decorative chrome, right-aligned in the header. Never load-bearing. */
  meta?: string;
  /** Optional image block, left of the fields on `sm` and above. */
  portrait?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="rounded-sm border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-3 py-2 font-mono text-[11px] tracking-widest uppercase"
        style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
      >
        <span style={{ color: 'var(--accent)' }}>{title}</span>
        {meta && <span aria-hidden="true">{meta}</span>}
      </div>

      <div className="flex flex-col gap-4 px-3 py-3 sm:flex-row sm:items-start sm:gap-5 sm:px-4 sm:py-4">
        {portrait && <div className="shrink-0">{portrait}</div>}
        <dl className="min-w-0 flex-1 space-y-2">{children}</dl>
      </div>

      {footer && (
        <div
          className="border-t px-3 py-3 sm:px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * One labelled row. Renders nothing when `children` is null or undefined, so
 * a caller can pass an unset field straight through without a conditional.
 *
 * The leader is a dotted rule that eats the slack between label and value —
 * it is what makes a list of fields read as an instrument rather than a form.
 * It is `aria-hidden`, and the <div> wrapper around each dt/dd pair is the
 * form <dl> permits.
 */
export function ConsoleField({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  if (children === null || children === undefined || children === false) {
    return null;
  }

  return (
    // Below `sm` the row stacks: label over value, no leader. A leader only
    // works when the value fits on the label's line — at 390px the role wraps
    // to two lines and the rule becomes a stub pointing at nothing.
    <div className="sm:flex sm:items-baseline sm:gap-2">
      <dt
        className="shrink-0 font-mono text-[11px] tracking-wider uppercase sm:min-w-28"
        style={{ color: 'var(--fg-muted)' }}
      >
        {label}
      </dt>
      <span
        aria-hidden="true"
        className="hidden h-px min-w-3 flex-1 sm:block"
        style={{
          // A real dotted leader rather than `border-dotted`, which renders
          // as a near-solid hairline at 1px in both themes.
          backgroundImage:
            'repeating-linear-gradient(to right, var(--border) 0 2px, transparent 2px 5px)',
          // Baseline-aligned rather than `self-end`: when a value wraps to a
          // second line, an end-aligned leader drops to the bottom of the
          // wrapped block and reads as a broken stub under the label.
          transform: 'translateY(-0.32em)',
        }}
      />
      <dd
        className="mt-0.5 min-w-0 text-sm sm:mt-0 sm:text-right"
        style={{ color: 'var(--fg)' }}
      >
        {children}
      </dd>
    </div>
  );
}
