import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Md } from '@/components/notes/GuideBody';
import { MockExam } from '@/components/notes/MockExam';
import { getGuide, getGuideSlugs, getMock, getSemesters } from '@/lib/notes';
import 'katex/dist/katex.min.css';

type Params = { params: Promise<{ semester: string; course: string; paper: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSemesters('cse').flatMap((s) =>
    getGuideSlugs('cse', s.slug).flatMap((course) =>
      (getGuide('cse', s.slug, course)?.mocks ?? []).map((m) => ({
        semester: s.slug,
        course,
        paper: m.slug,
      })),
    ),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { semester, course, paper } = await params;
  const g = getGuide('cse', semester, course);
  const m = getMock('cse', semester, course, paper);
  return g && m ? { title: `${g.code} ${m.title}` } : {};
}

export default async function MockPaperPage({ params }: Params) {
  const { semester, course, paper } = await params;
  const guide = getGuide('cse', semester, course);
  const mock = getMock('cse', semester, course, paper);
  if (!guide || !mock) notFound();

  // Everything with Markdown or maths is rendered here, on the server.
  const text: Record<string, ReactNode> = { intro: <Md source={mock.intro} /> };
  for (const s of mock.sections) {
    text[`sec:${s.id}`] = <Md source={s.blurb} />;
    for (const c of s.scenarios ?? []) text[`scn:${s.id}:${c.id}`] = <Md source={c.text} />;
    for (const q of s.questions) {
      text[`${q.id}:prompt`] = <Md source={q.prompt} />;
      text[`${q.id}:explain`] = <Md source={q.explain} />;
      if (q.kind === 'mcq') q.options.forEach((o, i) => (text[`${q.id}:opt:${i}`] = <Md source={o} />));
      if (q.kind === 'long')
        q.parts.forEach((p, i) => {
          text[`${q.id}:p${i}:prompt`] = <Md source={p.prompt} />;
          text[`${q.id}:p${i}:answer`] = <Md source={p.answer} />;
        });
    }
  }

  return (
    <MockExam
      paper={mock}
      code={guide.code}
      courseTitle={guide.title}
      storageKey={`${guide.code.toLowerCase()}-${mock.slug}-v2`}
      backHref={`/notes/cse/${semester}/${course}/mock`}
      text={text}
    />
  );
}
