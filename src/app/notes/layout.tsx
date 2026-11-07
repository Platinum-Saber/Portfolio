import type { Metadata } from 'next';
import './notes.css';

/**
 * The notes section: members-only study guides for CSE students
 * (docs/NOTES.md). Its own visual language - neo-brutalist, scoped under
 * `.nb` in notes.css and loaded only on these routes - deliberately apart
 * from the console look of the portfolio proper.
 */
export const metadata: Metadata = {
  title: { default: 'Notes', template: '%s - Notes' },
  description: 'Study guides for CSE students at the University of Moratuwa.',
  robots: { index: false, follow: false },
};

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="nb nb-wide">{children}</div>;
}
