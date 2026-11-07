import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // /notes is members-only (docs/NOTES.md): nothing there to index.
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/notes', '/notes-files', '/api/notes'],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
