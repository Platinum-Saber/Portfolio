import type { MetadataRoute } from 'next';
import { getProjectSlugs } from '@/lib/projects';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/projects', '/about', '/contact'].map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const projectRoutes = getProjectSlugs().map((slug) => ({
    url: `${site.url}/projects/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...projectRoutes];
}
