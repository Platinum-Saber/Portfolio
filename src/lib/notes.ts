import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * Members-only study guides: content/notes/<dept>/<semester>/<course>.mdx.
 *
 * Read at BUILD time only, like content/projects - every notes route is
 * prerendered with dynamicParams = false, because the Worker has no
 * filesystem. The middleware gate decides who receives the prebuilt pages.
 */

const ROOT = path.join(process.cwd(), 'content', 'notes');

export type NoteFile = {
  /** Shown on the download card, e.g. "Part 1 - Chapters 1–6". */
  label: string;
  /** Path under public/notes-files/, e.g. "cse/sem7/en3330-part-1.pdf". */
  file: string;
  pages?: number;
  sizeMb?: number;
};

/** An extra tab of a course: content/notes/<dept>/<sem>/<course>/<slug>.mdx */
export type PartRef = { slug: string; label: string };
/** A mock paper: content/notes/<dept>/<sem>/<course>/mocks/<slug>.json */
export type MockRef = { slug: string; label: string };

export type GuideFrontmatter = {
  code: string;
  title: string;
  summary: string;
  order: number;
  /** Label of the main guide's tab when the course has parts (default "Theory"). */
  tab?: string;
  parts?: PartRef[];
  mocks?: MockRef[];
  /** One line under the heading of the course's mock-paper page. */
  mockIntro?: string;
  /** One short line on what the guide is built from. */
  sources?: string;
  files?: NoteFile[];
  updated?: string;
};

export type Guide = GuideFrontmatter & {
  dept: string;
  semester: string;
  slug: string;
  body: string;
  sections: GuideSection[];
};

export type GuideSection = {
  id: string;
  num: string;
  title: string;
  tags: string[];
  /** The section's first `<PdfRef>`: where the side panel opens for it. */
  file?: string;
  page?: number;
};

export type Semester = {
  dept: string;
  slug: string;
  number: number;
  label: string;
};

const SEM = /^sem(\d+)$/;

export function semesterLabel(slug: string): string {
  const m = SEM.exec(slug);
  return m ? `Semester ${m[1]}` : slug;
}

export function getSemesters(dept: string): Semester[] {
  const dir = path.join(ROOT, dept);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SEM.test(d.name))
    .map((d) => ({
      dept,
      slug: d.name,
      number: Number(SEM.exec(d.name)![1]),
      label: semesterLabel(d.name),
    }))
    .filter((s) => getGuideSlugs(dept, s.slug).length > 0)
    .sort((a, b) => a.number - b.number);
}

export function getGuideSlugs(dept: string, semester: string): string[] {
  const dir = path.join(ROOT, dept, semester);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''));
}

/** `<Section id="s1" num="1" title="...">` - the contents list is read straight from the source. */
const SECTION_TAG = /<Section\b([^>]*)>/g;
const attr = (s: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1];

export function getGuide(
  dept: string,
  semester: string,
  slug: string,
): Guide | null {
  const file = path.join(ROOT, dept, semester, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const sections = parseSections(content);
  return {
    dept,
    semester,
    slug,
    body: content,
    sections,
    ...(data as GuideFrontmatter),
  };
}

export function getGuides(dept: string, semester: string): Guide[] {
  return getGuideSlugs(dept, semester)
    .map((s) => getGuide(dept, semester, s))
    .filter((g): g is Guide => g !== null)
    .sort((a, b) => a.order - b.order);
}

// ------------------------------------------------------------ course parts

export type Part = {
  slug: string;
  title: string;
  summary: string;
  files?: NoteFile[];
  body: string;
  sections: GuideSection[];
};

function parseSections(content: string): GuideSection[] {
  const tags = [...content.matchAll(SECTION_TAG)];
  return tags.map((m, i) => {
    const end = i + 1 < tags.length ? tags[i + 1].index : content.length;
    const ref = /<PdfRef\b([^>]*)>/.exec(content.slice(m.index, end));
    const page = ref ? Number(attr(ref[1], 'page')) : NaN;
    return {
      id: attr(m[1], 'id') ?? '',
      num: attr(m[1], 'num') ?? '',
      title: attr(m[1], 'title') ?? '',
      tags: (attr(m[1], 'tags') ?? '').split(/\s+/).filter(Boolean),
      file: ref ? attr(ref[1], 'file') : undefined,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
    };
  });
}

export function getPart(
  dept: string,
  semester: string,
  course: string,
  slug: string,
): Part | null {
  const file = path.join(ROOT, dept, semester, course, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  return {
    slug,
    body: content,
    sections: parseSections(content),
    ...(data as Omit<Part, 'slug' | 'body' | 'sections'>),
  };
}

/** The tab strip shown in the reader for a course with parts or mocks. */
export function courseTabs(
  g: Guide,
  active: string,
): { href: string; label: string; active: boolean }[] {
  if (!g.parts?.length && !g.mocks?.length) return [];
  const base = `/notes/${g.dept}/${g.semester}/${g.slug}`;
  return [
    { href: base, label: g.tab ?? 'Theory', active: active === '' },
    ...(g.parts ?? []).map((p) => ({
      href: `${base}/${p.slug}`,
      label: p.label,
      active: active === p.slug,
    })),
    ...(g.mocks?.length
      ? [{ href: `${base}/mock`, label: 'Mock papers', active: active === 'mock' }]
      : []),
  ];
}

// ------------------------------------------------------------ mock papers

export type MockQuestion = MockQuestionBody & {
  /** Id of a scenario in the section that this question refers to. */
  scenario?: string;
};

export type MockQuestionBody =
  | { id: string; kind: 'mcq'; marks: number; lab?: string; prompt: string; options: string[]; answer: number; explain: string }
  | { id: string; kind: 'fill'; marks: number; lab?: string; prompt: string; code: string; blanks: { options: string[]; answer: number }[]; explain: string }
  | { id: string; kind: 'order'; marks: number; lab?: string; prompt: string; lines: string[]; explain: string }
  | { id: string; kind: 'spot'; marks: number; lab?: string; prompt: string; code: string; answer: number[]; explain: string }
  | { id: string; kind: 'code'; marks: number; lab?: string; prompt: string; starter: string; solution: string; rubric: { text: string; marks: number }[]; explain: string }
  | {
      /** A written-exam question: several parts, each with a model answer and a self-marking scheme. */
      id: string;
      kind: 'long';
      marks: number;
      lab?: string;
      prompt: string;
      parts: { label: string; marks: number; prompt: string; answer: string; points: { text: string; marks: number }[] }[];
      explain: string;
    };

export type MockSection = {
  id: string;
  title: string;
  blurb: string;
  /** Shared context (a program, a measurement table) that several questions refer to. */
  scenarios?: { id: string; title: string; text: string }[];
  questions: MockQuestion[];
};

export type MockPaper = {
  slug: string;
  title: string;
  minutes: number;
  intro: string;
  sections: MockSection[];
};

export function getMock(
  dept: string,
  semester: string,
  course: string,
  slug: string,
): MockPaper | null {
  const file = path.join(ROOT, dept, semester, course, 'mocks', `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return { slug, ...(JSON.parse(fs.readFileSync(file, 'utf8')) as Omit<MockPaper, 'slug'>) };
}

// ------------------------------------------------------------ code files

/**
 * A source file shown in a guide (lab solutions). Read at build time, so the
 * page always shows exactly the file that was compiled and tested.
 * `from` / `to`: start at the first line containing `from`, stop before the
 * first later line containing `to`.
 */
export function readCode(src: string, from?: string, to?: string): string {
  return readCodeRange(src, from, to).code;
}

/**
 * The captured output of a code file, stored next to it as out/<name>.txt
 * (e.g. code/lab1-ex1.c → code/out/lab1-ex1.txt). Null when there is none.
 */
export function readCodeOutput(src: string): string | null {
  const dir = path.dirname(src);
  const base = path.basename(src).replace(/\.[^.]+$/, '');
  const file = path.join(ROOT, dir, 'out', `${base}.txt`);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').replace(/\s+$/, '');
}

/** Like readCode, plus the 1-based line number the excerpt starts at and the file's length. */
export function readCodeRange(
  src: string,
  from?: string,
  to?: string,
): { code: string; start: number; end: number; total: number } {
  const file = path.join(ROOT, src);
  if (!file.startsWith(ROOT) || !fs.existsSync(file))
    return { code: `/* missing: ${src} */`, start: 1, end: 1, total: 1 };
  const all = fs.readFileSync(file, 'utf8').replace(/\s+$/, '').split('\n');
  let a = 0;
  let b = all.length;
  if (from) {
    const i = all.findIndex((l) => l.includes(from));
    if (i >= 0) a = i;
  }
  if (to) {
    const j = all.findIndex((l, k) => k > a && l.includes(to));
    if (j > a) b = j;
  }
  const lines = all.slice(a, b);
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
  return { code: lines.join('\n'), start: a + 1, end: a + lines.length, total: all.length };
}
