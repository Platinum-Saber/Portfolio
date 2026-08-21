# Portfolio — Suhan Waduge

Personal portfolio site. Robotics and embedded systems work, with a 3D interactive layer
planned on top of a static-first core.

- **Architecture and rationale:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Build plan and progress:** [`PLAN.md`](./PLAN.md) ← start here to see the current phase

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), fully prerendered |
| Styling | Tailwind CSS v4, CSS custom properties for theming |
| Content | MDX files in `content/projects/`, parsed with `gray-matter` |
| Hosting | Vercel |
| 3D *(phase 2)* | react-three-fiber + drei |
| Database *(phase 5)* | Supabase — contact form only, never on the render path |

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Adding a project

Create `content/projects/<slug>.mdx`. The frontmatter is typed in
`src/lib/projects.ts`:

```yaml
---
title: Project Name
summary: One or two sentences. Shown on cards and used as the meta description.
order: 3          # lower sorts first — robotics and embedded lead
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
generated from the file — nothing else to register.

## Notable decisions

- **No `output: 'export'`.** Every page is statically prerendered anyway, but keeping the
  default output leaves room for the Vercel Function the phase 5 contact form needs.
- **System font stack, not a webfont.** Zero network requests and no layout shift, which
  matters against the performance budget. `src/app/layout.tsx` documents how to switch.
- **Theme in the DOM, not React state.** A synchronous inline script sets `data-theme`
  before first paint; the toggle reads and writes that attribute. No flash, no hydration
  mismatch.
- **Content is in the repo, never in the database.** Supabase free projects pause after
  about a week of inactivity — exactly a portfolio's traffic pattern. Nothing a visitor
  reads may depend on it.

## License

MIT — see [LICENSE](./LICENSE).
