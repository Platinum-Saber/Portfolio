import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideShell } from '@/components/notes/GuideShell';
import { GuideBody } from '@/components/notes/GuideBody';
import {
  courseTabs,
  getGuide,
  getGuideSlugs,
  getPart,
  getSemesters,
  semesterLabel,
} from '@/lib/notes';

type Params = { params: Promise<{ semester: string; course: string; part: string }> };

// A course's extra tab (e.g. Labs). Prebuilt only - the Worker has no filesystem.
export const dynamicParams = false;

export function generateStaticParams() {
  return getSemesters('cse').flatMap((s) =>
    getGuideSlugs('cse', s.slug).flatMap((course) =>
      (getGuide('cse', s.slug, course)?.parts ?? []).map((p) => ({
        semester: s.slug,
        course,
        part: p.slug,
      })),
    ),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { semester, course, part } = await params;
  const g = getGuide('cse', semester, course);
  const p = getPart('cse', semester, course, part);
  return g && p ? { title: `${g.code} ${p.title}` } : {};
}

export default async function PartPage({ params }: Params) {
  const { semester, course, part } = await params;
  const guide = getGuide('cse', semester, course);
  const p = getPart('cse', semester, course, part);
  if (!guide || !p) notFound();
  const files = p.files ?? guide.files ?? [];

  return (
    <GuideShell
      storageKey={`${guide.code.toLowerCase()}-${p.slug}-v1`}
      code={guide.code}
      title={p.title}
      sections={p.sections}
      files={files}
      backHref={`/notes/cse/${semester}`}
      backLabel={semesterLabel(semester)}
      tabs={courseTabs(guide, p.slug)}
    >
      <header className="nb-guide-head">
        <p className="nb-code">{guide.code}</p>
        <h1 className="nb-display">{p.title}</h1>
        <p className="nb-lead">{p.summary}</p>
        {files.length > 0 && (
          <ul className="nb-files">
            {files.map((f) => (
              <li key={f.file}>
                <a href={`/notes-files/${f.file}`} className="nb-file" target="_blank" rel="noopener">
                  <span className="nb-file-badge">PDF</span>
                  <span className="nb-file-label">{f.label}</span>
                  <span className="nb-muted">{f.pages ? `${f.pages} pages` : ''}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>
      <GuideBody source={p.body} />
    </GuideShell>
  );
}
