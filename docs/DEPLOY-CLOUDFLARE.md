# Deploying to Cloudflare Workers

The site moved from Vercel to Cloudflare Workers on 2026-09-24. It runs through the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare): `next build` as usual, then
`opennextjs-cloudflare` repackages the output as one Worker plus static assets.

## What is in the repo, and why

| File | Job |
|---|---|
| `wrangler.jsonc` | The Worker: name, entry, compatibility flags, assets binding. **Must be committed.** Without it, Workers Builds auto-generates a default on every build and throws it away, and that default is what took the first deploy down |
| `open-next.config.ts` | The **static-assets incremental cache** with cache interception. Prerendered HTML/RSC is served as an asset; no page is ever rendered on request |
| `public/_headers` | Cache headers: `_next/static` immutable for a year; models, images and video a day plus stale-while-revalidate |
| `package.json` scripts | `preview` (build + run in local workerd), `deploy` (build + populate cache + deploy), `upload` (build + upload a version without promoting it) |
| `.gitignore` | `.open-next/`, `.wrangler/`, `.dev.vars` |

`src/app/projects/[slug]/page.tsx` sets `dynamicParams = false` and `src/app/opengraph-image.tsx`
reads its portrait inside the handler — both so that nothing touches a filesystem at request time.

## Why the first deploy 500'd on every page

The first build reported success and every page returned `500 Internal Server Error`; only static
files and `/api/contact` worked. Two things combined:

1. **No cache configured** (the auto-generated setup printed *"Failed to set up cache for your
   project"*). With no incremental cache, OpenNext re-renders every "static" page inside the
   Worker on each request instead of serving what `next build` produced.
2. **A Worker has no filesystem.** Rendering reached `opengraph-image.tsx`, which read
   `public/images/portrait-og.jpg` at module scope → `ENOENT` → every route failed, because the
   module is evaluated as part of the shared server bundle. `lib/projects.ts` (reads
   `content/projects/*.mdx`) would have been next.

Reproduced and fixed in local workerd (`wrangler dev`): all 13 routes 200, unknown slug 404,
RSC navigation payloads served, zero errors.

The 40 `ERROR Failed to copy … node_modules/mdast-util-…` lines in the build log are the MDX
compiler's packages, which OpenNext could not trace into the server bundle. Harmless *because*
nothing renders at runtime — MDX compiles during `next build` only. If they ever start to matter,
it will be because something began rendering on request, which is the real bug.

## Dashboard settings (Workers & Pages → portfolio → Settings → Build)

| Setting | Value |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Non-production branch deploy command | `npx opennextjs-cloudflare upload` |
| Root directory | *(repo root)* |

**Do not use plain `npx wrangler deploy`.** It skips populating the cache, and the site 500s
again. (The first deploy happened to work only because Wrangler detected OpenNext and delegated —
with nothing to populate.)

## Secrets (Settings → Variables and Secrets — the Worker's, NOT the build's)

**Trap, hit on 2026-09-24:** Settings has *two* "Variables and secrets" panels. The one under
**Build** (beside Branch control, Build watch paths and API token) is for the build container
only — values there exist while `next build` runs and are gone when the Worker serves a request.
Put the Supabase pair there and the form answers `503 unavailable` with the "could not reach its
database" fallback, while the dashboard shows both secrets as set. They belong in the
**top-level** Variables and Secrets panel on the Worker's Settings page (or
`npx wrangler secret put SUPABASE_URL`, which writes to the same place).

| Name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Secret | same as `.env.local` |
| `SUPABASE_ANON_KEY` | Secret | same as `.env.local` |

Runtime secrets on the **Worker**, not build variables: `/api/contact` reads them per request.
Without them the form answers `503 unavailable` and the page falls back to `mailto:`, by design.
Verified locally that values set this way reach the route.

Unlike Vercel, a secret change takes effect on the live Worker without a rebuild (Cloudflare
deploys a new version with the new secret).

Locally: put the same two lines in `.dev.vars` (git-ignored) for `npm run preview`.

## Checks after a deploy

- `/`, `/projects`, a case study, `/explore` → 200 HTML, not `text/plain` 500
- `/projects/nope` → 404
- Submit the contact form once → a row in `contacts` and a Discord embed
- Worker logs: Workers & Pages → portfolio → Logs (observability is on). `[contact] …` lines mean
  the same things they did on Vercel (see `PHASE-5-SUPABASE.md`)

## Custom domain — `sansikawaduge.dev`

1. Worker → Settings → Domains & Routes → Add → Custom domain → subdomain **empty** → Production.
   Cloudflare creates the DNS record and the certificate itself (a few minutes).
2. `www`: add `www` the same way, then Rules → Redirect Rules → template *Redirect from WWW to
   root* (301, preserve path and query). One canonical origin, so links and search rankings
   are not split between two.
3. `.dev` is on the HSTS preload list: HTTPS only, in every browser, with no setting to change.
4. `site.url` in `src/lib/site.ts` is the canonical origin for the sitemap, robots.txt and
   OpenGraph URLs — already `https://sansikawaduge.dev`.
5. The `*.workers.dev` URL keeps serving a copy of the site. Harmless for search — every page's
   canonical link points at `sansikawaduge.dev` — and preview URLs for branches live on that
   subdomain, so leave `workers_dev` on unless the duplicate becomes a problem.

## Leftovers from Vercel

- `vercel.json` can go once the Vercel project is deleted; it does nothing on Cloudflare.
- The Vercel project's env vars and the old `*.vercel.app` URL — delete the project when the
  Cloudflare URL is confirmed.
- The custom domain (Phase 6) is simpler here: if the domain's DNS is on Cloudflare, attach it
  under Settings → Domains & Routes.
