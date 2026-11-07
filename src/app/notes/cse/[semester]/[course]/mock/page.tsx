import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NotesBar } from '@/components/notes/NotesBar';
import { courseTabs, getGuide, getGuideSlugs, getMock, getSemesters, semesterLabel } from '@/lib/notes';

type Params = { params: Promise<{ semester: string; course: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSemesters('cse').flatMap((s) =>
    getGuideSlugs('cse', s.slug)
      .filter((course) => (getGuide('cse', s.slug, course)?.mocks ?? []).length > 0)
      .map((course) => ({ semester: s.slug, course })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { semester, course } = await params;
  const g = getGuide('cse', semester, course);
  return g ? { title: `${g.code} mock papers` } : {};
}

const TINTS = ['nb-tint-pink', 'nb-tint-blue', 'nb-tint-yellow', 'nb-tint-mint'];

export default async function MockIndexPage({ params }: Params) {
  const { semester, course } = await params;
  const guide = getGuide('cse', semester, course);
  if (!guide?.mocks?.length) notFound();
  const papers = guide.mocks
    .map((m) => getMock('cse', semester, course, m.slug))
    .filter((m) => m !== null);

  return (
    <>
      <NotesBar
        crumbs={[
          { label: 'Notes' },
          { href: '/notes/cse', label: 'CSE' },
          { href: `/notes/cse/${semester}`, label: semesterLabel(semester) },
          { label: `${guide.code} mock papers` },
        ]}
      />
      <header className="nb-page-head">
        <nav className="nb-tabs-row" aria-label="Course parts">
          {courseTabs(guide, 'mock').map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.active ? 'page' : undefined} className="nb-tab">
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="nb-code">{guide.code}</p>
        <h1 className="nb-display">Mock papers</h1>
        <p className="nb-lead">
          {guide.mockIntro ??
            'Timed papers you can do online. After you submit, every question shows its answer and a mark scheme.'}
        </p>
      </header>
      <ul className="nb-stack">
        {papers.map((p, i) => {
          const marks = (id: string) =>
            p.sections.find((s) => s.id === id)?.questions.reduce((a, q) => a + q.marks, 0) ?? 0;
          return (
            <li key={p.slug}>
              <article className={`nb-card nb-course ${TINTS[i % TINTS.length]}`}>
                <p className="nb-code">
                  {p.minutes} min · {p.sections.reduce((a, s) => a + s.questions.length, 0)} questions
                </p>
                <h2 className="nb-h2">
                  <Link href={`/notes/cse/${semester}/${course}/mock/${p.slug}`} className="nb-stretch">
                    {p.title}
                  </Link>
                </h2>
                <p className="nb-course-sum">
                  {p.sections.map((s) => `${s.title} ${marks(s.id)}`).join(' · ')}
                </p>
                <div className="nb-course-foot">
                  <span className="nb-cta">Open the paper →</span>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
