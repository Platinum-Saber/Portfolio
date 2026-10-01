# Portfolio - Suhan Waduge

Personal portfolio site - robotics and embedded systems work, with an interactive 3D layer
(`/lab`, `/explore`) on top of a static-first core. Live at <https://sansikawaduge.dev>.

## Documentation

Everything except this file lives in [`docs/`](./docs).

| Document | What it is |
|---|---|
| [`docs/PLAN.md`](./docs/PLAN.md) | Build plan, phase status and the decision log ← **start here** |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Why the stack is what it is, and why EC2 was dropped |
| [`docs/DESIGN-LANGUAGE.md`](./docs/DESIGN-LANGUAGE.md) | The console metaphor and the rules every surface follows |
| [`docs/PHASE-5-SUPABASE.md`](./docs/PHASE-5-SUPABASE.md) | Contact-form setup runbook |
| [`docs/DEPLOY-CLOUDFLARE.md`](./docs/DEPLOY-CLOUDFLARE.md) | Hosting on Cloudflare Workers - config, dashboard settings, secrets |

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), fully prerendered |
| Styling | Tailwind CSS v4, CSS custom properties for theming |
| Content | MDX files in `content/projects/`, parsed with `gray-matter` |
| Hosting | Cloudflare Workers via OpenNext (moved from Vercel 2026-09-24) |
| 3D | react-three-fiber + drei, three.js confined to `/lab` and `/explore` routes |
| 3D assets | `assets/raw/` → `npm run assets:build` (gltf-transform, meshopt, WebP) → `public/models/` |
| Database | Supabase - contact form only, never on the render path |

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run preview  # build + run in local workerd - the real Worker runtime
npm run assets:build   # rebuild public/models from assets/raw
npm run lint
```

## Adding a project

Create `content/projects/<slug>.mdx`. The frontmatter is typed in
`src/lib/projects.ts`:

```yaml
---
title: Project Name
summary: One or two sentences. Shown on cards and used as the meta description.
order: 3          # lower sorts first - robotics and embedded lead
year: '2026'
status: in-progress   # in-progress | complete | archived
domain: Robotics      # groups projects on /projects
featured: true        # surfaces it on the home page
stack: ['ROS 2', 'C++']
repo: https://github.com/...    # optional
demo: https://...               # optional
writeup: https://...            # optional
---
```

The body below the frontmatter is MDX. The route, sitemap entry and metadata are all
generated from the file - nothing else to register.

## Notable decisions

- **No `output: 'export'`.** Every page is statically prerendered anyway, but keeping the
  default output leaves room for the one server route, `/api/contact`, which runs in the Worker.
- **System font stack for reading, one self-hosted face for chrome.** Body text uses the
  system stack - zero requests, no layout shift. Cards, tags and buttons use CMU Typewriter
  Text Light, self-hosted and subset (`public/fonts/`, SIL OFL), since 2026-09-26.
- **Theme in the DOM, not React state.** A synchronous inline script sets `data-theme`
  before first paint; the toggle reads and writes that attribute. No flash, no hydration
  mismatch.
- **Content is in the repo, never in the database.** Supabase free projects pause after
  about a week of inactivity - exactly a portfolio's traffic pattern. Nothing a visitor
  reads may depend on it.

## License

MIT - see [LICENSE](./LICENSE).
