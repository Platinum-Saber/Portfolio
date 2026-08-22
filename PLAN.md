# 3D Portfolio — Build Plan & Progress

**Owner:** Suhan · **Repo:** `D:\Projects\Portfolio`
**Architecture rationale:** see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
**Started:** 2026-08-21 · **Last updated:** 2026-08-22

> **How to use this file.** Each phase is independently completable and ends in something deployed and working. Tick boxes as you go, update the status table, and append to the Decision Log whenever you make a call that a future session would otherwise have to re-litigate. To resume after a break, read §1 and §2, then jump to the first phase not marked ✅.

---

## 1. Status at a glance

| # | Phase | Outcome when done | Status |
|---|---|---|---|
| 0 | Foundations | Repo + Vercel deploy pipeline live | ✅ Done |
| 1 | Content core | Readable, fast, non-3D portfolio online | 🟡 In progress |
| 2 | 3D layer | Airframe Explorer on /lab, within budget | 🟡 Built, needs device test |
| 3 | Asset pipeline | Optimised GLB/KTX2 built in CI | ⏸️ Parked — nothing to process |
| 4 | In-browser demo | One live CV/graphics demo, client-side | 🟡 Built, needs device test |
| 5 | Supabase | Contact form, RLS, degrades gracefully | 🟡 Code done, needs your accounts |
| 6 | Polish & launch | Domain, a11y, perf gates, SEO | ⬜ Not started |
| 7 | *Optional* — AWS artifact | IaC repo + write-up, spun up on demand | ⬜ Not started |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⏸️ Parked

**Currently working on:** Phase 5 code is written and its failure paths are tested. What
is left is account work only — running the SQL, setting two env vars in Vercel, deploying
the notification function, adding two GitHub secrets. Step-by-step in
[`docs/PHASE-5-SUPABASE.md`](./docs/PHASE-5-SUPABASE.md).

Still outstanding from earlier phases: one pass on a real mid-range Android covering both
`/lab` and `/lab/sobel`, the CV PDF, and the LinkedIn URL.

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

**Concept (settled):** the **Airframe Explorer** at `/lab` — an interactive schematic of the
FYP quadrotor. Six numbered markers on leader lines; selecting one shows the component's
specs, what it's wired to, and its honest build status. Wireframe/instrument styling in the
site accent. Reached from the drone project write-up, not from the main nav, so the reading
path stays clean.

**Geometry:** generated procedurally from primitives in `src/components/lab/Airframe.tsx`,
not loaded from a mesh file. Costs kilobytes rather than megabytes, needs no asset pipeline,
and stays editable as code as the real build changes.

- [x] Decide the concept — Airframe Explorer, documented above
- [x] Install `three`, `@react-three/fiber`, `@react-three/drei`
- [x] Build the scene; lazy-load the canvas, content renders first
- [x] `prefers-reduced-motion` respected — stops prop spin and auto-rotate
- [x] WebGL capability detection → clean fallback (full component reference is static HTML)
- [x] Pause rendering when tab is hidden / canvas off-screen (IntersectionObserver + visibilitychange)
- [x] Mobile: DPR capped at 1.75, closer default camera under 640px, constant-size tap targets
- [x] Auto-rotate stops on first interaction — a drifting model makes markers hard to hit
- [ ] **Measure on a real mid-range Android**, not a throttled desktop ← only open item

**On the model looking like bare lines:** that is the intended styling, not a missing
texture. Every mesh is `meshBasicMaterial` at 18–35% opacity with a drei `<Edges>` overlay
in the site accent — an instrument schematic, deliberately not a render. It is also what
keeps the scene unlit (no lights, no shadow maps, no PBR) and therefore cheap. If it ever
*should* look solid, that is a concept change, not a bug fix: see the Decision Log.

**Measured so far (SwiftShader, desktop):** content pages load 455 KB uncompressed JS;
`/lab` loads 1,382 KB, so three.js and drei (~930 KB, ~240 KB gzipped) are isolated to that
one route and fetched only after it renders. No console errors.

**Done when:** the scene holds up on a real phone. Everything else is verified.

---

### Phase 3 — Asset pipeline — ⏸️ PARKED (2026-08-22)
*Goal: asset optimisation is reproducible and automatic. Skip until you have more than a couple of models.*

**Parked, not abandoned.** The repo contains no mesh files at all — the airframe is
procedural geometry and the Sobel demo is two triangles — so every task below would build
a pipeline that processes zero assets, and a CI job with no inputs rots silently. Unpark
the moment a real `.glb` needs to ship; the checklist below is still the right one.

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

**Built:** `/lab/sobel` — Sobel edge detection as a WebGL2 fragment shader, live on the
visitor's camera. Reached from the FPGA write-up and from `/lab`, not from the main nav.

- [x] Pick the demo — **GLSL Sobel on webcam input**. Same 3×3 convolution as the Basys 3 Verilog build, so the two write-ups explain each other
- [x] Implement behind a **"Run demo"** button — never auto-start, never load on page load
- [x] Camera permission handled gracefully; every failure mode (`NotAllowedError`, `NotFoundError`, `NotReadableError`, no `mediaDevices`) gets its own sentence and a one-click route to the fallback
- [x] Fallback source is a **procedurally drawn test target**, not a bundled clip — contrast staircase, converging-line resolution wedge, soft gradient, moving hard-edged shapes. Costs ~2 KB of JS and moves, which a still image would not
- [x] `prefers-reduced-motion` freezes the test target's animation
- [x] WebGL2 capability detection → clean fallback; the kernels are printed in the page, so nothing is hidden inside the shader
- [x] Render loop stops when the tab is hidden or the canvas scrolls off-screen; camera tracks are stopped on unmount
- [x] Loading/warming state with an honest message
- [x] Short write-up next to it explaining what it's doing, and why it isn't a Python API
- [ ] ~~ONNX / int8 / Web Worker~~ — not applicable, there is no model
- [ ] **Try it on a real mid-range Android** ← only open item

**Done when:** a stranger can click one button and see something visibly impressive within a few seconds, on a phone.

---

### Phase 5 — Supabase
*Goal: a contact form that works, and that cannot take the site down.*

**Setup runbook:** [`docs/PHASE-5-SUPABASE.md`](./docs/PHASE-5-SUPABASE.md) — the account
steps, each with a way to check it worked.

- [x] Create project
- [x] `contacts` table — `supabase/migrations/0001_contacts.sql`, re-runnable
- [x] **RLS on. Insert-only for `anon`. No select.** Grants revoked and handed back
      *column-level* (`name, email, message, source`) so `id` and `created_at` cannot be
      forged either
- [x] Form submission via Vercel Function — `src/app/api/contact/route.ts`, plain `fetch`
      to PostgREST, no `@supabase/supabase-js`
- [x] Spam mitigation — honeypot, minimum fill time, in-memory sliding window on a hashed
      IP. Limits documented honestly in the runbook
- [x] Email notification — Resend, via a Supabase Edge Function fired by a database
      webhook, so notification is downstream of storage and cannot fail the submission
- [x] **Failure path:** every non-success path ends in a `mailto:` link prefilled with what
      the visitor typed. Verified against a stubbed PostgREST returning 401, 403 and a hung
      connection, plus a wholly unconfigured deployment — all four produce the same calm
      panel, the hang inside a 6 s timeout
- [x] GitHub Actions cron every other day — hits the PostgREST root, not the table, since
      `anon` has no select privilege
- [x] `SUPABASE_URL` and `SUPABASE_ANON_KEY` set in `.env.local` (2026-08-22) — confirmed
      to parse cleanly through `@next/env` despite CRLF line endings, and the JWT payload
      confirms `role: anon`, not `service_role`
- [x] `npm run verify:supabase` — a re-runnable probe of the live project: key role, table
      exists, anon cannot read, forged `created_at` refused, CHECK constraints bite
- [x] **Database side verified against the live project (2026-08-22).** `0001_contacts.sql`
      is applied and behaving: anon cannot read (401), cannot delete (401), cannot forge
      `created_at` (401); the insert path returns 201; CHECK constraints reject a
      5-character message (400). Note this project maps permission-denied to **401**, not
      403 — do not read those as auth failures
- [ ] Apply `0002_healthcheck.sql`, then re-run `npm run verify:supabase` — it should be
      all PASS
- [ ] Clear the probe rows: `delete from public.contacts where source = 'verify-probe';`
      plus the four rows from the first two runs (see the runbook)
- [ ] **Commit and push the Phase 5 files.** As of the `e30c5ff` deploy none of them were
      tracked, which is why `/api/contact` is absent from that build's route list
- [ ] Remaining runbook steps — the two Vercel env vars, the notify function deploy, the
      two GitHub secrets
- [ ] Repeat the bad-key test once on a real preview deployment

> Neither this container nor the desktop sandbox can reach `*.supabase.co`. Everything
> known about the live project came from Suhan running `npm run verify:supabase` and
> pasting the output. A session cannot check this itself — do not let one claim otherwise.

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
- **2026-08-21** — 3D scene is an **interactive drone schematic on its own `/lab` page**, linked from the drone write-up rather than sitting in the nav. Content pages stay pure text and fast; three.js loads on one route only.
- **2026-08-21** — Airframe geometry is **procedural, not a CAD import**. The intended source (Stanford MSL TrajBridge) turned out to have no CAD at all — it's a PX4↔ROS 2 bridge. The hardware CAD lives in `StanfordMSL/msl_quad`, is SolidWorks-only (`.SLDPRT`/`.SLDASM`) for every structural part, and describes an F330 frame with an Odroid XU4 — not this build. Procedural geometry is smaller, needs no conversion, no licence question, and is honestly *this* aircraft.
- **2026-08-21** — Auto-rotation stops permanently on first pointer interaction. Found while testing: a slowly drifting model makes the hotspots genuinely hard to hit, especially on touch.
- **2026-08-21** — Hotspot markers use fixed screen size (no `distanceFactor`) with leader lines back to the component. Perspective-scaled markers shrank to untappable sizes and piled up on each other.
- **2026-08-22** — The contact API route uses the **anon key, not the service role key**, and talks to PostgREST with plain `fetch`. The anon key plus insert-only RLS is exactly the authority the endpoint needs; a service role key would let it read every message ever sent, for no benefit. `@supabase/supabase-js` would have added ~100 KB to the function bundle to save four lines.
- **2026-08-22** — ~~`Prefer: return=minimal` is load-bearing~~ — **wrong, corrected same day.** Measured against the live project: PostgREST already defaults to `return=minimal` for POST, so the header-less insert returns 201 exactly the same. The claim came from `@supabase/supabase-js`, which defaults to `return=representation` — true of the client library, not of PostgREST. The header stays as an explicit statement of a real constraint (anon has no select, so asking for the row back *is* a 401, verified), which protects whoever later swaps the raw `fetch` for the client library. Kept for that reason, not the one originally written down.
- **2026-08-22** — Anon's INSERT grant is **column-level** (`name, email, message, source`). A table-level grant would let whoever holds the public key supply their own `id` and `created_at`. A CHECK constraint cannot substitute — Postgres only accepts IMMUTABLE functions in CHECK, and `now()` is STABLE.
- **2026-08-22** — The spam timing check **fails open**. Found in testing: `Number(null)` is `0`, which is finite and below the floor, so a submission arriving without a measurement was being silently binned. Quietly losing a real message is far worse than accepting one more bot, which still has the honeypot and the rate limiter to get past. The route now judges only an actual number.
- **2026-08-22** — The contact form has no error state at all. Rate limited, database paused, key rotated, network dropped, Supabase never configured — every path renders the same calm paragraph and a `mailto:` link carrying what the visitor already typed. The static contact details stay on the page underneath, in the HTML, JavaScript or not.
- **2026-08-22** — Email notification runs on a **database webhook**, not from the site. Notification is therefore downstream of the write: if Resend is down or the free tier is spent, the row is still saved and the visitor still sees success. A notification failure must never look like a submission failure.
- **2026-08-22** — The keep-alive cron calls a `public.healthcheck()` RPC, after the first version — pinging the PostgREST root — turned out to answer **401** to the anon key on this project, which would have failed every scheduled run. A 401 is also useless as a health signal: it is indistinguishable from a wrong key or a dropped grant. And PostgREST serves that root from a cached schema, so it may never touch Postgres, which is the one thing a pause-prevention ping must do. The RPC returns `now()` and nothing else, executes in the database, and a 200 means 200. Requires `0002_healthcheck.sql`.
- **2026-08-22** — Added `vercel.json` pinning `"framework": "nextjs"`. The `e30c5ff` deploy failed with `No Output Directory named "public" found` — not a build failure at all (`next build` completed and generated all 17 pages), but Vercel treating the project as Framework Preset *Other*, which runs the build and then hunts for a folder of static files to serve. Pinning it in the repo makes the setting version-controlled rather than a dashboard checkbox nobody remembers ticking.
- **2026-08-22** — Phase 3 parked before Phase 4 rather than built in order. There are no mesh files in the repo to optimise, so the pipeline would have had no inputs; a CI job with nothing to do fails quietly and teaches you nothing. Unpark when a real `.glb` first needs to ship.
- **2026-08-22** — The Sobel demo is **plain WebGL2, not three.js**. One shader over two triangles; a scene graph would have added ~930 KB to save about forty lines. This is why `/lab/sobel` is 468 KB against `/lab`'s 1,382 KB — three.js stays confined to the one route that genuinely needs it.
- **2026-08-22** — The no-camera fallback is a **procedurally drawn test target**, not a bundled sample clip, for the same reason the airframe is procedural: a video would have been the heaviest asset on the site. It also animates, which matters — a still image cannot demonstrate that the convolution runs per frame. Its content is diagnostic on purpose (contrast staircase, resolution wedge, smooth gradient), so the page can point at what the operator does and does not respond to.
- **2026-08-22** — Gradient magnitude passes through a `smoothstep(0.06, 0.55)` rather than a hard threshold. A binary cut looks crisp on a test chart and turns to speckle on a noisy phone camera.
- **2026-08-22** — The render loop lives in an effect keyed by a session id that is also the `<canvas>` key. Disposing a WebGL context calls `loseContext()`, which permanently poisons that canvas element — found in testing, where a second run failed with "shader failed to compile". Every run therefore gets a brand-new canvas. Do not "simplify" this back into the click handler.
- **2026-08-22** — Confirmed the `/lab` airframe's bare-lines appearance is the intended instrument-schematic styling (unlit `meshBasicMaterial` + `<Edges>`), not a missing texture. Recorded because it reads as a defect at first glance and will otherwise be "fixed" by a future session.
- **2026-08-21** — `site.cv` and `socials.linkedin` ship as `null` and their links render conditionally, so the live site never carries a dead link while those are outstanding.

---

## 5. Open questions

- [x] ~~What's the concept for the 3D scene?~~ — Airframe Explorer, see Phase 2
- [ ] Which domain name? (blocks Phase 6, and blocks a proper Resend sender address — until then the form notifies via `onboarding@resend.dev`, which can only mail your own signup address)
- [x] ~~Which projects make the cut, and in what order?~~ — six written, ordered robotics → embedded → backend. Revisit if any feels weak.

---

## 6. Notes & measurements

_Record asset sizes, Lighthouse scores, and fps measurements here as you go — before/after numbers are useful portfolio content in their own right._

| Date | What | Measurement |
|---|---|---|
| 2026-08-21 | Content routes, uncompressed JS | 455 KB |
| 2026-08-21 | `/lab` (three.js + drei), uncompressed JS | 1,382 KB |
| 2026-08-22 | `/lab/sobel`, uncompressed JS | 468 KB — **+13 KB over baseline**, no three.js |
| 2026-08-22 | `/lab/sobel` under SwiftShader (software rasteriser, worst case) | 16–23 fps, camera and test target alike |

Measured by loading each route from `next start` in headless Chromium and summing JS
response bodies. The number worth keeping: a real-time CV demo cost 13 KB, because it is
one shader and two triangles rather than a scene graph.
