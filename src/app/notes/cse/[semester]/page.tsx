import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NotesBar } from '@/components/notes/NotesBar';
import { getGuides, getSemesters, semesterLabel } from '@/lib/notes';

type Params = { params: Promise<{ semester: string }> };

// Prebuilt only - the Worker has no filesystem (docs/DEPLOY-CLOUDFLARE.md).
export const dynamicParams = false;

export function generateStaticParams() {
  return getSemesters('cse').map((s) => ({ semester: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { semester } = await params;
  return { title: semesterLabel(semester) };
}

const TINTS = [
  'nb-tint-mint',
  'nb-tint-yellow',
  'nb-tint-pink',
  'nb-tint-blue',
  'nb-tint-orange',
];

export default async function SemesterPage({ params }: Params) {
  const { semester } = await params;
  const guides = getGuides('cse', semester);
  if (guides.length === 0) notFound();
  const label = semesterLabel(semester);

  return (
    <>
      <NotesBar
        crumbs={[
          { label: 'Notes' },
          { href: '/notes/cse', label: 'CSE' },
          { label },
        ]}
      />
      <header className="nb-page-head">
        <Link href="/notes/cse" className="nb-link nb-back">
          ← All semesters
        </Link>
        <h1 className="nb-display">{label}</h1>
      </header>

      <ul className="nb-stack">
        {guides.map((g, i) => (
          <li key={g.slug}>
            <article className={`nb-card nb-course ${TINTS[i % TINTS.length]}`}>
              <p className="nb-code">{g.code}</p>
              <h2 className="nb-h2">
                <Link
                  href={`/notes/cse/${semester}/${g.slug}`}
                  className="nb-stretch"
                >
                  {g.title}
                </Link>
              </h2>
              <p className="nb-course-sum">{g.summary}</p>
              <div className="nb-course-foot">
                <span className="nb-cta">Open the guide →</span>
                <span className="nb-muted">
                  {g.sections.length} sections
                  {g.files?.length ? ` · ${g.files.length} PDFs` : ''}
                </span>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
