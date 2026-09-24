import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * Serve what `next build` prerendered; never render a page on request.
 *
 * Every route on this site is static (○/● in the build output) except
 * /api/contact. The static-assets cache ships the prerendered HTML and RSC
 * payloads as Worker assets, and cache interception answers from them before
 * the Next server is even loaded. That is the static-first architecture of
 * docs/ARCHITECTURE.md, expressed for Workers — and it is not optional here:
 * a render on request would need a filesystem (content/projects/*.mdx, the OG
 * portrait) that a Worker does not have.
 *
 * No R2 / KV / D1: nothing is revalidated at runtime, so there is nothing to
 * store. Adding ISR later would mean switching to the R2 cache.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
