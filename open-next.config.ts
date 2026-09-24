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
  // MUST stay false. Cache interception answers from the cache before Next
  // runs — and it ignores Next 16's per-segment prefetch requests
  // (`Next-Router-Segment-Prefetch: /_tree`), returning the whole page's RSC
  // payload to each. The router cannot use it and re-requests at once, so
  // every open tab re-prefetched each in-view link ~15×/s — 520,780 requests
  // from 248 page views on 2026-09-24, 5× the Workers Free daily limit.
  // Off, the Next handler serves those requests itself, still from the
  // prebuilt static-assets cache: nothing renders, no filesystem needed.
  // Measured locally (wrangler dev): an idle tab went from ~3,500 Worker
  // requests/min to 29 one-off prefetches. docs/DEPLOY-CLOUDFLARE.md.
  enableCacheInterception: false,
});
