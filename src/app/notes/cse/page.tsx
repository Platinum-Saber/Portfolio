import type { Metadata } from 'next';
import Link from 'next/link';
import { NotesBar } from '@/components/notes/NotesBar';
import { getGuides, getSemesters } from '@/lib/notes';

export const metadata: Metadata = { title: 'CSE' };

const ROT = ['nb-rot-l', 'nb-rot-r', 'nb-rot-0'];
const TINTS = [
  'nb-tint-mint',
  'nb-tint-yellow',
  'nb-tint-pink',
  'nb-tint-blue',
];

export default function CseNotesPage() {
  const semesters = getSemesters('cse');
  return (
    <>
      <NotesBar crumbs={[{ label: 'Notes' }, { label: 'CSE' }]} />
      <header className="nb-page-head">
        <p className="nb-sticker nb-rot-r">
          Computer Science &amp; Engineering
        </p>
        <h1 className="nb-display">All semesters</h1>
        <p className="nb-lead">Pick a semester to see its study guides.</p>
      </header>
      <ul className="nb-grid">
        {semesters.map((s, i) => {
          const guides = getGuides('cse', s.slug);
          return (
            <li key={s.slug}>
              <Link
                href={`/notes/cse/${s.slug}`}
                className={`nb-card nb-card-link nb-sem ${TINTS[i % TINTS.length]}`}
              >
                <span className={`nb-sem-num ${ROT[i % ROT.length]}`}>
                  S{s.number}
                </span>
                <span className="nb-h2">{s.label}</span>
                <span className="nb-muted">
                  {guides.length} guide{guides.length === 1 ? '' : 's'} ·{' '}
                  {guides.map((g) => g.code).join(', ')}
                </span>
                <span className="nb-cta">Open →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
