# 3D Portfolio — Build Plan & Progress

**Owner:** Suhan · **Repo:** `D:\Projects\Portfolio`
**Architecture rationale:** see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
**Started:** 2026-08-21 · **Last updated:** 2026-08-21

> **How to use this file.** Each phase is independently completable and ends in something deployed and working. Tick boxes as you go, update the status table, and append to the Decision Log whenever you make a call that a future session would otherwise have to re-litigate. To resume after a break, read §1 and §2, then jump to the first phase not marked ✅.

---

## 1. Status at a glance

| # | Phase | Outcome when done | Status |
|---|---|---|---|
| 0 | Foundations | Repo + Vercel deploy pipeline live | ✅ Done |
| 1 | Content core | Readable, fast, non-3D portfolio online | 🟡 In progress |
| 2 | 3D layer | Hero scene over the content, within budget | ⬜ Not started |
| 3 | Asset pipeline | Optimised GLB/KTX2 built in CI | ⬜ Not started |
| 4 | In-browser demo | One live CV/graphics demo, client-side | ⬜ Not started |
| 5 | Supabase | Contact form, RLS, degrades gracefully | ⬜ Not started |
| 6 | Polish & launch | Domain, a11y, perf gates, SEO | ⬜ Not started |
| 7 | *Optional* — AWS artifact | IaC repo + write-up, spun up on demand | ⬜ Not started |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⏸️ Parked

**Currently working on:** Phase 1 — site is built and building clean; remaining items are the CV PDF, the LinkedIn URL, and picking the final project order.

---

## 2. Locked decisions

These are settled. Changing one means updating this file and noting why in the Decision Log.

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Vercel (Hobby) | Global CDN, free for personal use. Keep the site non-commercial — no rate cards, no client sales. |
| Framework | **Next.js (App Router), static export where possible** | SSG gives real HTML for SEO/ATS scraping; good R3F support. *Reversible in Phase 0 only* — Vite + a prerender step is the alternative. |
| 3D | react-three-fiber + drei | Same three.js engine, declarative, `<Suspense>` asset loading. |
| Content source | MDX/JSON committed in repo | Zero runtime DB dependency on the render path. Cannot break. |
| Asset processing | Build-time, GitHub Actions | Not a runtime concern. No server. |
| ML/CV demos | In-browser (ONNX Runtime Web / WebGPU / TF.js) | Free, no cold start, scales, stronger demonstration than a REST endpoint. |
| Heavy inference (if ever needed) | Hugging Face Space, scale-to-zero | $0 idle. Opt-in button, never blocks the page. |
| Database | Supabase Free, non-critical paths only, RLS on from day one | Free projects pause after ~1 week idle — never let a render depend on it. |
| Always-on EC2 | **Dropped** | Not free after credits; too small to serve CV models. |
| Budget | $0/mo + domain (~$10–15/yr) | Hard constraint. |

**Performance budget (enforced from Phase 2 onward):**
- Critical path < 2 MB · total initial 3D payload < 5 MB
- 60 fps on a mid-range Android
- Lighthouse Performance ≥ 90 on mobile
- Text content readable with WebGL disabled

---

## 3. Phases

### Phase 0 — Foundations
*Goal: a deploy pipeline that works, before there's anything to deploy.*

- [x] `git init`, push to GitHub (public — it's a portfolio artifact in itself)
- [x] Scaffold Next.js + TypeScript + Tailwind
- [x] Add ESLint + Prettier
- [x] Connect repo to Vercel, confirm push-to-deploy works
- [ ] Verify the preview URL loads from a phone
- [x] Commit `ARCHITECTURE.md` and `PLAN.md` to the repo

**Done when:** a trivial change pushed to `main` is live on `*.vercel.app` within ~2 minutes.

---

### Phase 1 — Content core
*Goal: a complete, genuinely useful portfolio with zero 3D. This alone is shippable — most recruiters will only read this layer.*

- [x] Decide site structure (home / projects / about / contact)
- [x] Write bio — short version (2 lines) and long version
- [x] Set up MDX pipeline for project write-ups
- [x] Write project pages — **6 written**, robotics and embedded weighted first:
  - [x] FPGA real-time Sobel edge detection (Basys 3, Vivado)
  - [x] Multi-robot 3D mapping / SLAM
  - [x] Autonomous drone platform (FYP)
  - [x] Financial market data backend (Redis/Kafka/Spring Boot)
  - [x] ASCILAM collaborative multi-robot SLAM
  - [x] 4-bit Nano Processor (VHDL)
  - [x] Kobuki + Webots mobile robot control
  - [ ] Review the set and cut any that don't earn their place
- [x] Each project page: problem → approach → what you built → result → stack → links (repo/demo/video)
- [ ] **CV as a PDF** → drop at `public/suhan-waduge-cv.pdf`, then set `cv` in `src/lib/site.ts` (currently `null`, so no dead link ships)
- [x] Responsive layout, clean typography, dark/light
- [x] Basic SEO: title/description per page, OpenGraph image, sitemap, robots.txt
- [ ] **LinkedIn URL** → set `socials.linkedin` in `src/lib/site.ts` (currently `null`)
- [ ] Deploy and read it on a phone end-to-end

**Done when:** you'd be comfortable sending the link to a recruiter *today*, with no 3D on the page.

---

### Phase 2 — 3D layer
*Goal: one well-executed scene layered over the content — not five janky ones.*

- [ ] Decide the concept (hero scene? interactive project navigator? ambient background?) — write it down here
- [ ] Install `three`, `@react-three/fiber`, `@react-three/drei`
- [ ] Build the scene; lazy-load the canvas, content renders first
- [ ] `prefers-reduced-motion` respected
- [ ] WebGL capability detection → clean 2D fallback
- [ ] Pause rendering when tab is hidden / canvas off-screen (battery + fps)
- [ ] Mobile: lower DPR cap, simplified scene, touch controls that don't fight page scroll
- [ ] Measure on a real mid-range Android, not a throttled desktop

**Done when:** the scene hits the performance budget on a real phone and the page is fully usable with WebGL disabled.

---

### Phase 3 — Asset pipeline
*Goal: asset optimisation is reproducible and automatic. Skip until you have more than a couple of models.*

- [ ] Source/author models; keep originals in `assets/raw/` (git-lfs if large)
- [ ] `gltf-transform optimize` (or `gltfpack`) — Draco/meshopt geometry compression
- [ ] KTX2/Basis texture compression (`toktx`)
- [ ] GitHub Action: run on push to `assets/raw/`, emit to `public/models/`
- [ ] Record before/after sizes in the Notes section — good portfolio material
- [ ] Confirm the optimised assets still render correctly

**Done when:** dropping a raw `.glb` into the repo produces an optimised, budget-compliant asset with no manual steps.

---

### Phase 4 — In-browser demo
*Goal: one live, interactive demo that shows real CV/graphics skill. Client-side only.*

- [ ] Pick the demo. Recommended first choice: **WebGL/WebGPU shader edge detection on webcam input** — real time, no model, no server, thematically adjacent to the FPGA Sobel project (nice narrative link: "same algorithm, three implementations — FPGA, CPU, GPU shader")
- [ ] Implement behind a **"Run demo"** button — never auto-start, never load on page load
- [ ] Camera permission handled gracefully; offer a sample image/video for anyone who declines
- [ ] If using a model instead: export to ONNX, quantise to int8, keep under ~25 MB, run in a Web Worker
- [ ] Loading/warming state with an honest message
- [ ] Short write-up next to it explaining what it's doing

**Done when:** a stranger can click one button and see something visibly impressive within a few seconds, on a phone.

---

### Phase 5 — Supabase
*Goal: a contact form that works, and that cannot take the site down.*

- [ ] Create project (note the region — pick something reasonable for a global audience)
- [ ] `contacts` table
- [ ] **RLS on. Insert-only policy for `anon`. No select.** (the anon key is public by definition)
- [ ] Form submission via Vercel Function or Supabase Edge Function
- [ ] Spam mitigation (honeypot field + basic rate limit)
- [ ] Email notification on new submission
- [ ] **Failure path:** if Supabase is unreachable or paused, the form degrades to a `mailto:` link with a clear message — never an error state
- [ ] GitHub Actions cron every 2–3 days issuing a trivial query, to prevent inactivity pause
- [ ] Test the failure path deliberately (bad key / offline) and confirm graceful degradation

**Done when:** the form works, *and* the site is still perfect with Supabase fully down.

---

### Phase 6 — Polish & launch
- [ ] Buy the domain, point it at Vercel, verify HTTPS
- [ ] Accessibility pass: keyboard nav, focus states, alt text, contrast, real text (not baked into canvas)
- [ ] Lighthouse CI or bundle-size check gating PRs (stops the slow rot into a 40 MB page)
- [ ] Cross-browser: Chrome, Firefox, Safari (incl. iOS Safari — the usual WebGL offender)
- [ ] OpenGraph/Twitter cards render correctly when the link is pasted into LinkedIn/WhatsApp
- [ ] Privacy: no analytics that needs a cookie banner, or use a cookieless one
- [ ] Confirm Vercel Hobby non-commercial framing is respected
- [ ] Update CV and LinkedIn with the new URL

**Done when:** the URL is on your CV.

---

### Phase 7 — *Optional* — AWS artifact
*Goal: demonstrate backend/infra skill without paying idle rent. Do this when you're actively interviewing.*

- [ ] Separate repo: Python service (FastAPI) + Dockerfile
- [ ] Terraform or CDK: VPC, ECS/EC2, ALB
- [ ] GitHub Actions deploy workflow
- [ ] Architecture diagram + write-up, linked from the portfolio
- [ ] Deploy live only during an interview loop, then **tear down**
- [ ] Set an AWS budget alert at $5 before doing any of this

**Done when:** the repo stands on its own as evidence, with nothing running.

---

## 4. Decision log

Append here whenever a non-obvious call gets made. Format: date — decision — why.

- **2026-08-21** — Dropped always-on EC2 from the architecture. AWS replaced the 12-month EC2 free tier with $100 credits / 6-month Free Plan; an always-on t3.micro is ~$12–13/mo and would exhaust credits in ~8 months. Separately, 1 GB RAM cannot serve CV models. Both are independently blocking.
- **2026-08-21** — ML/CV demos move to in-browser inference (ONNX Runtime Web / WebGPU) rather than a hosted Python API. Free, no cold start, no CORS, scales, and is a stronger demonstration.
- **2026-08-21** — 3D asset processing moved to build-time CI. It's a deterministic transform of files we control; it never needed to be a runtime service.
- **2026-08-21** — Portfolio content lives in-repo as MDX, not in Supabase. Supabase free projects pause after ~1 week of inactivity, which is exactly a portfolio's traffic pattern.
- **2026-08-21** — Next.js kept on the default output rather than `output: 'export'`. Every page prerenders statically either way, but the default leaves room for the Vercel Function the Phase 5 contact form needs.
- **2026-08-21** — System font stack instead of `next/font` + Inter. Saves a network round trip and eliminates font-driven layout shift, against a strict performance budget. `src/app/layout.tsx` documents the switch back.
- **2026-08-21** — Theme state lives in the DOM (`data-theme` attribute), not React state. A synchronous inline script sets it before first paint; the toggle reads and writes the attribute and CSS picks the icon. No flash, no hydration mismatch, no mount effect.
- **2026-08-21** — `site.cv` and `socials.linkedin` ship as `null` and their links render conditionally, so the live site never carries a dead link while those are outstanding.

---

## 5. Open questions

- [ ] What's the concept for the 3D scene? (blocks Phase 2)
- [ ] Which domain name? (blocks Phase 6)
- [x] ~~Which projects make the cut, and in what order?~~ — six written, ordered robotics → embedded → backend. Revisit if any feels weak.

---

## 6. Notes & measurements

_Record asset sizes, Lighthouse scores, and fps measurements here as you go — before/after numbers are useful portfolio content in their own right._

| Date | What | Measurement |
|---|---|---|
| | | |
