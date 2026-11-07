import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideShell } from '@/components/notes/GuideShell';
import { GuideBody } from '@/components/notes/GuideBody';
import {
  courseTabs,
  getGuide,
  getGuideSlugs,
  getSemesters,
  semesterLabel,
} from '@/lib/notes';

type Params = { params: Promise<{ semester: string; course: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSemesters('cse').flatMap((s) =>
    getGuideSlugs('cse', s.slug).map((course) => ({
      semester: s.slug,
      course,
    })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { semester, course } = await params;
  const g = getGuide('cse', semester, course);
  return g ? { title: `${g.code} ${g.title}` } : {};
}

export default async function GuidePage({ params }: Params) {
  const { semester, course } = await params;
  const guide = getGuide('cse', semester, course);
  if (!guide) notFound();
  const semLabel = semesterLabel(semester);

  return (
    <GuideShell
      storageKey={`${guide.code.toLowerCase()}-v1`}
      code={guide.code}
      title={guide.title}
      sections={guide.sections}
      files={guide.files ?? []}
      backHref={`/notes/cse/${semester}`}
      backLabel={semLabel}
      tabs={courseTabs(guide, '')}
    >
      <header className="nb-guide-head">
        <p className="nb-code">{guide.code}</p>
        <h1 className="nb-display">{guide.title}</h1>
        <p className="nb-lead">{guide.summary}</p>
        {guide.sources && <p className="nb-muted">{guide.sources}</p>}
        {guide.files && guide.files.length > 0 && (
          <ul className="nb-files">
            {guide.files.map((f) => (
              <li key={f.file}>
                <a
                  href={`/notes-files/${f.file}`}
                  className="nb-file"
                  target="_blank"
                  rel="noopener"
                >
                  <span className="nb-file-badge">PDF</span>
                  <span className="nb-file-label">{f.label}</span>
                  <span className="nb-muted">
                    {[
                      f.pages && `${f.pages} pages`,
                      f.sizeMb && `${f.sizeMb} MB`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="nb-mode-note">
          <strong>Summary</strong> shows what you revise from.{' '}
          <strong>Detailed</strong> adds derivations and the longer worked
          examples. Switch at the top of the contents panel; page tags open the
          original notes in the panel on the right.
        </p>
      </header>

      <GuideBody source={guide.body} />
    </GuideShell>
  );
}
