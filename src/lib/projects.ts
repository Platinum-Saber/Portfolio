import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'projects');

export type ProjectStatus = 'in-progress' | 'complete' | 'archived';

export type ProjectFrontmatter = {
  title: string;
  summary: string;
  /** Lower numbers surface first. Embedded and robotics work leads. */
  order: number;
  year: string;
  status: ProjectStatus;
  domain: string;
  stack: string[];
  featured?: boolean;
  repo?: string;
  demo?: string;
  writeup?: string;
};

export type Project = ProjectFrontmatter & {
  slug: string;
  body: string;
};

export function getProjectSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''));
}

export function getProject(slug: string): Project | null {
  const file = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  return { slug, body: content, ...(data as ProjectFrontmatter) };
}

export function getAllProjects(): Project[] {
  return getProjectSlugs()
    .map(getProject)
    .filter((p): p is Project => p !== null)
    .sort((a, b) => a.order - b.order);
}

export function getFeaturedProjects(): Project[] {
  return getAllProjects().filter((p) => p.featured);
}
