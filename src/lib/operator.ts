import { site } from './site';

/**
 * The operator dossier - Phase 8.2.
 *
 * One source for the console card on `/` and the fuller one on `/about`, for
 * the same reason `skills.ts` exists: two copies would have disagreed the
 * first time a line changed. `/` renders SUMMARY under an <h1> that already
 * carries the name; `/about` renders IDENTITY + SUMMARY + EXTENDED, because
 * its heading is 'About' and the name has to appear somewhere.
 *
 * Every value here has to be true and checkable. The reference this card is
 * adapted from carries AGE and FAVORITE-MEAL and gets away with it because
 * its operator is a persona; a portfolio's entire currency is that a reader
 * can verify any line. Fields not yet known are `null` and do not render -
 * the same convention as `site.cv`.
 */
export type OperatorField = { label: string; value: string | null };

/** Only for cards whose own heading is not the name. Labelled NAME, not
 * OPERATOR, so it does not restate the card's own header. */
export const IDENTITY: OperatorField[] = [
  { label: 'Name', value: site.fullName },
];

export const SUMMARY: OperatorField[] = [
  { label: 'Role', value: site.tagline },
  { label: 'Education', value: site.education },
  { label: 'Base', value: site.location },
  { label: 'Stack', value: 'C++/Python · Java/Spring Boot · ROS 2 · Verilog/VHDL ' },
  { label: 'Status', value: site.availability },
];

export const EXTENDED: OperatorField[] = [
  { label: 'Focus', value: 'Embedded systems · robotics · perception' },
  {
    label: 'Experience',
    value: 'Intern Software Engineer · GTN Technologies · Nov 2025 – May 2026',
  },
  { label: 'Interests', value: 'Computer graphics · computer vision · CTFs' },
];
