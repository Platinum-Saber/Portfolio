# 3D Portfolio — Build Plan & Progress

**Owner:** Suhan · **Repo:** `D:\Projects\Portfolio`
**Architecture rationale:** see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
**Started:** 2026-08-21 · **Last updated:** 2026-09-03

> **Where the docs live.** Every markdown document except `README.md` is in `docs/` — this file,
> [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DESIGN-LANGUAGE.md`](./DESIGN-LANGUAGE.md) and
> [`PHASE-5-SUPABASE.md`](./PHASE-5-SUPABASE.md). The repo root is for things a tool reads;
> `README.md` stays there because GitHub renders it as the landing page. Moved 2026-09-03.

> **How to use this file.** Each phase is independently completable and ends in something deployed and working. Tick boxes as you go, update the status table, and append to the Decision Log whenever you make a call that a future session would otherwise have to re-litigate. To resume after a break, read §1 and §2, then jump to the first phase not marked ✅.

---

## 1. Status at a glance

| # | Phase | Outcome when done | Status |
|---|---|---|---|
| 0 | Foundations | Repo + Vercel deploy pipeline live | ✅ Done |
| 1 | Content core | Readable, fast, non-3D portfolio online | 🟡 In progress |
| 2 | 3D layer | Three interactive scenes + the explorable world | 🟡 Device test passed; scout CAD outstanding |
| 3 | Asset pipeline | Optimised GLB built in CI | ✅ Done |
| 4 | In-browser demo | One live CV/graphics demo, client-side | ✅ Done |
| 5 | Supabase | Contact form, RLS, degrades gracefully | 🟢 Form live, notifications live. Preview/Dev env vars, the bad-key test and probe cleanup remain |
| 6 | Polish & launch | Domain, a11y, perf gates, SEO | ⬜ Not started — *gates Phase 8* |
| 7 | ~~*Optional* — AWS artifact~~ | — | ❌ Dropped (2026-09-23) |
| 8 | Design architecture | One visual language across every route | 🟡 In progress — 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.9 done · 8.3 parked · 8.8 left |
| 9 | Diegetic world | Zone info delivered inside the scene, not over it | ⬜ Not started — **unblocked 2026-08-24** |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⏸️ Parked

**The lab, as of 2026-08-22.** Four interactive pieces, each on its own route so three.js
is never loaded by a content page:

| Route | What | Uncompressed JS |
|---|---|---|
| `/lab` | Airframe Explorer — the FYP quadrotor as a schematic | 1,402 KB |
| `/lab/sobel` | Sobel edge detection as a WebGL2 shader, live on camera | 475 KB (no three.js) |
| `/lab/ascilam` | Collaborative SLAM arena — two scouts, drift, fusion | 1,395 KB |
| `/explore` | The whole portfolio as a world you fly through | 1,469 KB + 437 KB models |
| `/explore/lab` | The portfolio as a room, with an interactive console | 1,468 KB + 3,100 KB models |
| `/lab/keeper` | Goalkeeper interception — two sightings, an EKF, one servo | not yet measured |

Content routes are unchanged at 462–475 KB. `/` gained only a link.

**Currently working on:** Phase 3 landed on 2026-08-23, out of order, because the first
real meshes arrived. `assets/raw/` → `npm run assets:build` → `public/models/`, wired to CI.
Both models are placed in `/explore`: the VT-802 is the craft you fly, in full PBR with a
generated environment map, and the quadcopter is parked scenery in the schematic language.
The world has a ground — a stylised city plate under the procedural skyline — and there is
now a second scene on the route: `/explore/lab`, an interior you fly a small drone around,
with a console that lists and opens every project. `/lab` is untouched and stays procedural
(see the Decision Log for why). Phase 5 code is written and its failure paths are tested. What
is left there is account work only — running the SQL, setting two env vars in Vercel, deploying
the notification function, adding two GitHub secrets. Step-by-step in
[`PHASE-5-SUPABASE.md`](./PHASE-5-SUPABASE.md).

**Next up: Phase 8 — Design architecture** (8.1 started 2026-08-24), added 2026-08-24 after a study of three
reference sites. The site is functional but does not read as one thing: `/explore` and `/lab`
speak a console language the content routes do not. Phase 8 closes that gap and runs *before*
Phase 6, since gating a design that has not been built yet is worthless. Rules in
[`DESIGN-LANGUAGE.md`](./DESIGN-LANGUAGE.md).

**The Android pass passed on 2026-08-24**, which closes Phase 4 and unblocks Phase 9. What is
left from earlier phases is the scout CAD swap-in (Phase 2) and the Supabase account work
(Phase 5).

**Resolved 2026-08-24:** both addresses are real — `sansikawaduge@` is the professional one
and `sansikasuhan5@` the personal one. The site now uses the professional address everywhere
(`site.email`, one change, six call sites), matching the CV.

**Closed 2026-09-22 — the GTN internship is on the site.** `/about` has an Experience section
fed by `src/lib/experience.ts`, the dossier carries an EXPERIENCE row, and
`content/projects/market-data-backend.mdx` was rewritten as the internship case study (slug kept
so the `/explore` zone and links survive). Written for a non-finance reader, from the CS3993
report, with company-internal system names, topic names and architecture specifics deliberately
left out. The original gap, for the record:

1. **The GTN Technologies internship is invisible on the site.** Nov 2025 – May 2026, Market
   Backend team — a named industry role with shipped work (Horus, the VWAP service). `/about`
   describes it as "production market data infrastructure" without the employer, the dates or
   the title, and there is no work-experience section anywhere. This is the single strongest
   ATS signal in the CV and the site does not carry it.

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
- [x] **CV as a PDF** → `public/suhan-waduge-cv.pdf`, `site.cv` set (2026-08-24). Served 200, 115,706 bytes, linked from `/about`
- [x] Responsive layout, clean typography, dark/light
- [x] Basic SEO: title/description per page, OpenGraph image, sitemap, robots.txt
- [x] **LinkedIn URL** → `socials.linkedin` set (2026-08-24); renders in the footer site-wide and on `/contact`
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
- [x] **Measured on a real mid-range Android** — passed 2026-08-24, covering `/lab`,
      `/lab/ascilam` and `/explore`. This was the gate on Phase 9 and the last open item in
      Phase 4. *Record the device and the observed frame rate in §6 when convenient — "it
      passed" is a verdict, and a number is evidence.*
- [ ] Drop the real scout CAD in when it is exported — swap-in point documented in
      `ScoutModel.tsx`. The pipeline is live now: add it to `ASSETS` in
      `scripts/build-assets.mjs` and render it through `SchematicModel`, as `/explore` does

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

### Phase 3 — Asset pipeline — ✅ Done (2026-08-23)
*Goal: asset optimisation is reproducible and automatic.*

**Unparked on 2026-08-23**, the moment two real `.glb` files existed. `assets/raw/` holds
the untouched sources; `npm run assets:build` (`scripts/build-assets.mjs`) writes
web-ready GLBs into `public/models/`; `.github/workflows/assets.yml` runs the same command
on any push touching `assets/raw/` and commits the result back. A Vercel build never sees
a mesh toolchain.

- [x] Source/author models; originals in `assets/raw/` — plain git, no LFS. **Now 101 MB,
      and `lab.glb` is 59 MB, past GitHub's 50 MB per-file warning though under the 100 MB
      hard limit.** GitHub warned on the first push (2026-08-24) exactly as expected, and
      the push succeeded — 85.6 MiB, `.git` now 87 MB. The blob is permanent in history;
      shrinking it later means a rewrite, not a `.gitignore`. Three ways out when it stops
      being tolerable, in increasing order of disruption: leave it and never add another
      asset this size; move `assets/raw/` to LFS going forward (history unchanged); or stop
      committing raw sources at all and keep only built output — which costs the CI
      workflow its trigger, and that trigger is the whole reason raw sources are in the
      repo. `models/environments/` is gitignored and
      must stay that way — it holds a 402 MB file that can never be committed
- [x] `gltf-transform` — flatten → dedup → join → **weld** → simplify (meshopt) → prune →
      quantize → EXT_meshopt_compression
- [x] Three profiles: `schematic` (appearance deleted, POSITION only), `pbr` (materials
      intact, NORMAL + TEXCOORD_0 kept), and `interior` — `pbr` that additionally does
      **not merge meshes**, so a room's objects stay individually addressable
- [x] Texture compression — **WebP via sharp**, not KTX2/Basis. Revisited and **measured**
      on the lab, as this line previously said to: KTX2 came out 5.92 MB on the wire
      against WebP's 2.53 MB, because UASTC normal maps are large and the KTX2 step
      decodes `EXT_meshopt_compression` on the way through. It buys ~12 MB VRAM against
      ~95 MB, but 5.92 MB alone breaches the 5 MB payload budget. The lever for VRAM here
      is **fewer maps, not a different codec**
- [x] GitHub Action on push to `assets/raw/`, emitting to `public/models/`
- [x] Before/after sizes recorded in §6
- [x] Optimised assets confirmed rendering — headless Chromium against `next start`,
      both models visible in `/explore`

**Done when:** ~~dropping a raw `.glb` into the repo produces an optimised,
budget-compliant asset with no manual steps.~~ It does.

**The one number that matters:** `weld` is the whole pipeline. The sources are unwelded —
vertices duplicated per triangle — so the simplifier sees no shared edges and can collapse
nothing at all. Without that single call the quadcopter comes out at 501,338 triangles
instead of 5,940.

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
- [x] **Tried on a real mid-range Android** — passed 2026-08-24

**Done when:** ~~a stranger can click one button and see something visibly impressive within a few seconds, on a phone.~~ **Phase complete.**

---

### Phase 5 — Supabase
*Goal: a contact form that works, and that cannot take the site down.*

**Setup runbook:** [`PHASE-5-SUPABASE.md`](./PHASE-5-SUPABASE.md) — the account
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
- [x] Notification — **Discord**, via a Supabase Edge Function fired by a database
      webhook, so notification is downstream of storage and cannot fail the submission.
      Was Resend; swapped 2026-09-04 because it needed a domain we do not own yet.
      **Deployed, wired and confirmed working 2026-09-04**
- [x] **Failure path:** every non-success path ends in a `mailto:` link prefilled with what
      the visitor typed. Verified against a stubbed PostgREST returning 401, 403 and a hung
      connection, plus a wholly unconfigured deployment — all four produce the same calm
      panel, the hang inside a 6 s timeout
- [x] GitHub Actions cron every other day — calls `public.healthcheck()`, not the
      PostgREST root and not the table: `anon` has no select privilege, and the root
      answers 401 to the anon key on this project anyway
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
- [x] Apply `0002_healthcheck.sql` (2026-09-04) — confirmed by the keep-alive workflow
      getting a 200 out of `healthcheck()`, which is only possible if the function exists
      and `anon` holds execute on it
- [x] Re-run `npm run verify:supabase` (2026-09-04) — **all eight checks PASS**, including
      `healthcheck()` at 200 in 957 ms. The database side of Phase 5 is finished
- [ ] Clear the probe rows: `delete from public.contacts where source = 'verify-probe';`
      plus the four rows from the first two runs (see the runbook)
- [x] **Commit and push the Phase 5 files** — all six are tracked as of `1b7ae3c`
      (route, verify script, both migrations, the Edge Function, the workflow)
- [x] Two GitHub Actions secrets (2026-09-04) — `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
      Runs #1–#7 were red purely for want of these; Actions secrets are a store of their
      own, and neither `.env.local` nor Vercel's environment variables reach a runner
- [x] **The two Vercel env vars, Production (2026-09-04)** — end-to-end proven: a message
      sent through the deployed form landed in `contacts`. The form is live
- [ ] Add the same two variables to **Preview and Development** — needed before the
      bad-key test, which otherwise fails for want of any configuration at all
- [x] Discord webhook created, notify function deployed with its two secrets, database
      webhook wired at timeout 5000 (2026-09-04) — a submission now reaches the channel
      within seconds of hitting the table
- [ ] Repeat the bad-key test once on a real preview deployment

> Neither this container nor the desktop sandbox can reach `*.supabase.co`. Everything
> known about the live project came from Suhan running `npm run verify:supabase` and
> pasting the output. A session cannot check this itself — do not let one claim otherwise.

**Done when:** the form works, *and* the site is still perfect with Supabase fully down.
First half met 2026-09-04 — stored and notified, end to end. Second half is verified against a
stubbed PostgREST and an unconfigured deployment but **not yet on a real preview**, which is the
one remaining item that actually proves the claim.

---

### Phase 6 — Polish & launch
- [ ] Buy the domain, point it at Vercel, verify HTTPS
- [ ] Accessibility pass: keyboard nav, focus states, alt text, contrast, real text (not baked into canvas)
- [ ] Lighthouse CI or bundle-size check gating PRs (stops the slow rot into a 40 MB page)
- [x] **Favicon.** Done 2026-09-03. `src/app/favicon.ico` (16/32/48), `src/app/icon.png`
      (192, transparent) and `src/app/apple-icon.png` (180, flattened onto `#0b0d10`), all
      generated from `public/icons/Battlefield.png`. Next emits the `<link>` tags itself
- [ ] Cross-browser: Chrome, Firefox, Safari (incl. iOS Safari — the usual WebGL offender)
- [ ] OpenGraph/Twitter cards render correctly when the link is pasted into LinkedIn/WhatsApp
- [ ] Privacy: no analytics that needs a cookie banner, or use a cookieless one
- [ ] Confirm Vercel Hobby non-commercial framing is respected
- [ ] Update CV and LinkedIn with the new URL

**Done when:** the URL is on your CV.

---

### Phase 7 — ~~*Optional* — AWS artifact~~ — ❌ DROPPED (2026-09-23)

**Scrapped. Will not be built.** Kept below for the record only.

*Goal: demonstrate backend/infra skill without paying idle rent. Do this when you're actively interviewing.*

- [ ] Separate repo: Python service (FastAPI) + Dockerfile
- [ ] Terraform or CDK: VPC, ECS/EC2, ALB
- [ ] GitHub Actions deploy workflow
- [ ] Architecture diagram + write-up, linked from the portfolio
- [ ] Deploy live only during an interview loop, then **tear down**
- [ ] Set an AWS budget alert at $5 before doing any of this

**Done when:** the repo stands on its own as evidence, with nothing running.

---

### Phase 8 — Design architecture
*Goal: make the site read as one machine. The content routes currently do not speak the
language `/explore` and `/lab` speak, and that gap — not a shortage of effects — is what
reads as disorganised.*

**Reference:** [`DESIGN-LANGUAGE.md`](./DESIGN-LANGUAGE.md) — the study of Igloo Inc,
IRIS K and Chrome Tattoo Paris, and every rule this phase implements. Read it first; this
section is the schedule, that file is the reasoning.

**Runs before Phase 6.** Phase 6 is the accessibility, Lighthouse and cross-browser gate, and
gating a design that has not been built yet is worthless. Phase 8 is numbered last and
sequenced second-to-last on purpose — renumbering would break every Decision Log reference.

**The governing metaphor is the instrument schematic / flight console.** Every new surface must
be explainable as part of the console. If it cannot be, it does not ship.

**The constraint that shapes all of it:** content routes stay at 462–475 KB with no three.js in
the initial graph. That rules out the GSAP + Lenis + Three stack all three reference sites use,
and it does not matter, because View Transitions and CSS scroll-driven animations cover the
effect at 0 KB. GSAP/Lenis remain permitted inside `/explore` and `/lab` only.

---

#### 8.1 — Tokens — ✅ Done (2026-08-24)

*Unblocks everything below, so nothing downstream hand-rolls a duration.*

- [x] Motion tokens in `@theme` — `--t-fast: 180ms`, `--t-page: 420ms`,
      `--ease-console: cubic-bezier(.16,1,.3,1)`, wired to `--default-transition-duration`
      and `--default-transition-timing-function` so **every existing `transition-*` class
      picks them up with no component edits**. Verified in the emitted CSS: `.transition-colors`
      resolves to `var(--tw-duration,var(--default-transition-duration))`
- [x] ~~One type scale in `@theme`~~ — **not built, and deliberately.** Tailwind's default
      scale already *is* one scale; authoring a second would be the exact disorganisation this
      phase exists to remove. 8.1 adds only what was missing: `--measure: 68ch`, defined and
      not yet applied
- [x] Real `prefers-reduced-motion` branch — the tokens collapse to 1 ms and
      `animation-timeline: none` detaches scroll-driven animations so they render at their
      **end** state. The blanket `!important` rule is kept underneath as a safety net, not as
      the design
- [x] `next build` passes; emitted CSS grew **150 bytes** and no utility changed shape

**Done.** The one visible change: the default transition duration moves 150 ms → 180 ms
site-wide, which is the point — one vocabulary, and every hover on the site now shares it.

**Authoring rule this establishes, for 8.4:** a scroll reveal must be written
**visible-by-default with the animation subtracting the start state.** An element that is
invisible without its animation will vanish entirely under reduced motion.

---

#### 8.2 — `ConsoleCard` + the two dossiers — ✅ Done (2026-08-24)

*The single highest organisational payoff on this list, and it is pure CSS.*

Anatomy: mono uppercase label · dotted leader · sans value; 1 px `--border`; 2 px corners; no
shadow, no gradient, no glass. Decorative chrome (version strings, corner ticks) is
`aria-hidden`.

- [x] `src/components/ConsoleCard.tsx` — `ConsoleCard` + `ConsoleField`. A field whose value is
      `null` renders **nothing**, so callers pass unset data straight through
- [x] `src/lib/operator.ts` — one source for both cards, for the same reason `skills.ts` exists.
      `/` renders `SUMMARY`; `/about` renders `IDENTITY + SUMMARY + EXTENDED`. Nothing is stated
      twice with two different values
- [x] `/` summary card above the fold. It **replaced** the standalone accent location line,
      which said in prose what the BASE row now says in the schema
- [x] `/about` full dossier, same primitive, extended not restated
- [x] Both themes verified by screenshot — light reads as ink-on-paper, dark as instrument
- [x] Mobile verified at 390 px: below `sm` the row stacks label-over-value and the leader is
      hidden. A leader only works when the value fits on the label's line
- [ ] ~~Reuse `StatusBadge` for the STATUS row~~ — **not done, and it should not be.** That
      component is typed to `ProjectStatus` (`in-progress` / `complete` / `archived`), which is
      a project's build state, not a person's availability. Forcing an availability string
      through it would have widened a well-typed component to mean two unrelated things
- [ ] ~~Retrofit `/explore` zone panels and `/lab` callouts~~ — **moved to 9.1**, where it was
      independently written down. It belongs there: it is scene work, and 9.1 is sequenced after
      the Android pass for a reason
- [x] `site.education` and `site.availability` filled from the CV (2026-08-24), so the card
      now renders all five rows
- [x] **Portrait** — `src/components/Portrait.tsx`, an optional slot on `ConsoleCard`. Head-and-
      shoulders crop of the source photo, pre-built to the two sizes the site uses (8 KB / 21 KB
      WebP) and served by a plain `<img>` with `srcset` and explicit `width`/`height`
- [x] Portrait added to the OpenGraph card as well — inlined as a data URI read from disk at
      build, since satori cannot fetch a relative URL and does not decode WebP
- [x] Both cards widened to `max-w-2xl`: at `max-w-xl` the portrait squeezed the field column
      and ROLE started wrapping

**Real data only.** The Chrome reference can invent AGE and FAVORITE-MEAL because it is a
persona; an engineering portfolio's currency is that every field is checkable. A dry true
field beats an invented quirky one. Junk-glyph noise: at most one instance per page — the
cards currently carry **none**, and neither needs it.

**Done.** `/` answers *who is this* above the fold in static HTML — measured at **+1 KB**, the
same +1 KB every route picked up from the shared chunk. No canvas, no client component, no
layout shift.

---

#### 8.3 — Transitions — ⏸️ PARKED (2026-08-24)

*One vocabulary, defined once, reused site-wide. Three different transitions read as a demo reel.*

**Parked on the first day of work, because the premise was wrong.** The plan said this was a
0 KB item on the strength of the View Transitions API. It is not, in this stack, today:

- `react@19.2.8` — the version this repo runs, and current stable — **does not export
  `unstable_ViewTransition`**. Verified by importing it. Next's `experimental.viewTransition`
  flag drives React's component, so the flag alone buys nothing; it needs a React canary.
- CSS `@view-transition { navigation: auto }` only fires on **cross-document** navigation.
  The App Router intercepts `<Link>` and navigates client-side, so the rule never runs.

Three ways forward, none of them free:

1. **Wait** for React to ship `ViewTransition` stable, then revisit. ← chosen 2026-08-24
2. Hand-roll it: a client `TransitionLink` wrapping navigation in
   `document.startViewTransition`. ~1–2 KB, gets real cross-fades *and* the shared-element
   morph today, at the cost of a client component on content routes and some fragility
   around knowing when an App Router navigation has actually finished.
3. Cross-document navigation — plain `<a>` plus the CSS rule. Genuinely 0 KB and spec-native,
   but throws away client-side routing and prefetch: every navigation becomes a full load.

**Recheck trigger:** any React upgrade. Test with
`node -e "console.log('unstable_ViewTransition' in require('react'))"` before reopening this.

---

#### 8.4 — Scroll disclosure — ✅ Done (2026-08-24)

*Scroll is progressive disclosure, never a hijack.*

- [x] `.rise` — pure CSS `animation-timeline: view()`, authored visible-by-default so the
      animation only ever *subtracts* the start state. On `ProjectCard`s and section headings
- [x] `.scroll-rail` — a reading-progress bar scrubbed by `animation-timeline: scroll(root)`,
      on case studies only. `aria-hidden`, and the only animated thing on that page
- [x] Native scroll preserved everywhere. No smooth-scroll library, no hijack, no preloader
- [x] **0 KB of JS on every route** — verified before and after. CSS grew 1,656 bytes
- [ ] ~~`IntersectionObserver` fallback~~ — **deliberately not built.** A browser without
      `animation-timeline` runs no animation and shows the content, which is the correct
      fallback and costs nothing. Shipping JS to a content route so a decoration works
      everywhere would trade this phase's whole premise for a fade

**Verified in a browser, both motion modes:**

| Check | Normal | `prefers-reduced-motion: reduce` |
|---|---|---|
| Card below the fold, opacity | 0 → 1 as it enters | **1 throughout** — never hidden |
| Rail, `scaleX` top → bottom of page | 0 → 1 | not rendered (opacity 0) |
| `.rise` elements on a case study | 0 | 0 |

The middle column is the one that matters: it is the failure mode 8.1 predicted, where a
reveal authored the other way round leaves reduced-motion users with an invisible page.

**Done when:** ~~`/` reads as a journey on a trackpad, a phone and a keyboard alike.~~ It does,
and it costs nothing to.

---

#### 8.5 — Particle fields (Tier A) — ✅ Done (2026-08-24)

*Telemetry about which page you are on, not decoration.*

**Built twice.** The first version was the planned canvas2D client component. It worked, and it
was thrown away: measured A/B on one build, a single client component on a single content route
cost **+2 KB on every route** — `/lab`, `/projects` and the case studies paying for a canvas
they never render, because a client module enters the shared graph. `next/dynamic` made it
*worse* (+5 KB, loader machinery in the same shared chunk). The shipped version is a **server
component** — seeded spans plus CSS animations — at **0 KB**.

- [x] One component, a `mood` prop. `/` standby dust (16 marks) · `/contact` rising streaks
      (14 marks, accent) · `/projects/[slug]` and everywhere else: none
- [x] Quickens while a form field has focus — `body:has(input:focus, textarea:focus)`, no
      listener, works with JavaScript disabled. Measured 10.9 s → 3.49 s
- [x] `aria-hidden`, `pointer-events: none`, `z-index: -10`; click-through verified
- [x] Absent entirely under `prefers-reduced-motion` — `display: none`, `animation-name: none`
- [x] **0 KB of JS on every route**, and `/lab` still reproduces 1,402 KB exactly. CSS +810 B
- [x] Positions come from `lib/random.ts`, not `Math.random` — a field that rearranged itself
      between server and client render is a hydration mismatch
- [ ] ~~`/projects` lattice with hover ripple~~ — dropped. Hover-only, so invisible on touch
- [ ] ~~`/about` near-still~~ — dropped. Indistinguishable from no field at all
- [ ] ~~burst on successful submit~~ — dropped. It needs a hook into the contact form's success
      path, and that flow is tested end to end. A decoration does not go inside it
- [ ] ~~`document.hidden` pause~~ — not applicable: CSS animations are already throttled by the
      browser when the tab is hidden. It was a canvas requirement

**Confined to the margins, and to desktop.** Marks are placed in the 0–11% and 89–100% bands,
which is roughly the margin either side of the reading column — a 1 px accent tick beside a
paragraph reads as a rendering artefact rather than as atmosphere. Below 900 px there is no
margin at all, so the field is simply absent. That also settles the contrast guardrail by
construction: the field is never behind text.

**Done when:** ~~the field is removable in one line and its absence is the only thing that
changes.~~ It is — and its presence costs nothing either.

---

#### 8.6 — The home portal — ✅ Done (2026-08-24)

*Decided 2026-08-24 — `DESIGN-LANGUAGE.md` §6.5.*

`/` ends at a console-boot panel: schematic frame, a still of the world, an explicit
`▸ TAKE CONTROL`. **The canvas mounts on activation, never on scroll-into-view.**

- [x] `src/components/HomePortal.tsx` — a `ConsoleCard` carrying the poster and four fields
      (SCENE · CONTROLS · PAYLOAD · FALLBACK). Server component, static HTML, no 3D anywhere
      in this route's graph
- [x] Poster is a **real frame from `/explore`**, captured from the built site with the DOM
      overlays hidden — 12.5 KB and 5.3 KB WebP. Not an illustration. Re-shoot it when the
      world changes; a portal showing a place that no longer exists is worse than no portal
- [x] The hero's old "Or fly through it →" button was **removed** with it. One invitation, at
      the end of the journey, instead of two competing ones
- [x] Measured. See the decision below — `/` went **down** 16 KB
- [ ] ~~Scene behind a `next/dynamic({ ssr: false })` chunk, imported by a click handler~~ —
      **not built.** `▸ Take control` is a plain `<Link>` to `/explore`. 8.5 established that a
      client component on a content route taxes *every* route, and an in-place mount needs one
      plus the dynamic loader — measured at +5 KB in 8.5's experiment — to buy continuity
      alone. The gate is identical either way: nothing 3D loads until the visitor acts
- [x] ~~Decide in-place mount vs navigate~~ — **decided by measurement: navigate.** This
      closes the open question left in §5
- [x] **Amended 2026-09-03:** the link is `/explore?fly=1`, not `/explore`. Navigating landed the
      visitor on a second, identical `Take control` — the same door asked to be opened twice. See
      the decision log

Auto-mount on scroll was proposed and rejected: ~1.9 MB pushed onto a mid-range Android that
did not ask for it, the homepage budget rule broken outright, and the deliberate-entry
etiquette inverted. The visitor opens the hangar door; the page does not open it for them.

**Done when:** the homepage is unchanged in weight and the world is one click away.

---

#### 8.9 — The guided home sequence — ✅ Done (2026-08-24)

*Requested 2026-08-24: "the viewers should be guided through — first only a summary appears,
then as the user scrolls more items appear while previous items disappear."*

`/` is a sequence of five chapters on one pinned stage, not a document that grows:
**Operator → What I build → Selected work → The lab → The door.**

- [x] `src/components/Chapter.tsx` — `Stage` + `Chapter`. One sticky surface, every chapter
      stacked absolutely on it, each animating over its own slice of the stage's view timeline
- [x] **0 KB of JavaScript.** Every route measures identical to baseline; `/lab` still 1,402 KB
- [x] `Explore` added to the title bar, so the simulation is reachable from every page
- [x] The in-page button row is gone. The nav carries the destinations; the operator card's
      footer carries the CV and the repo, which the nav does not
- [x] Below 900 px, without `animation-timeline`, or under `prefers-reduced-motion`: no stage,
      no pinning, ordinary vertical flow. Verified — all five chapters at opacity 1
- [x] **Nothing leaves the DOM.** A faded chapter is still findable, still read by a screen
      reader, still scraped. Only `opacity`, `transform` and `pointer-events` change

**Three failures on the way there, each caught by measuring rather than looking:**

| Attempt | What was wrong |
|---|---|
| A sticky runway per chapter | Consecutive runways are a viewport apart, so a chapter slid off the top while the next slid up from below — a normal scroll with fades, not a handoff |
| One stage, overlapping ranges | A true crossfade: two blocks of prose at 0.8 opacity superimposed. Unreadable |
| One stage, abutting ranges | **Shipped.** One chapter clears, the next arrives; ~330 px of scroll per handoff |

**Done.** Exactly one chapter is legible at any scroll position, the sequence is 5.9 screens,
and the page weighs what it did before.

---

#### 8.7 — Audio — ✅ Done (2026-09-03)

*IRIS K's etiquette, not its volume. `/explore` and `/lab` only — content routes stay silent.*

- [x] `AUDIO ▸ ARMED / MUTED` toggle in the console chrome — `components/AudioToggle.tsx`,
      one control, always visible, keyboard-reachable, `aria-pressed`. Two variants: the
      overlay palette on the two flight canvases, theme tokens on `/lab`, which has no
      canvas overlay to live in
- [x] Never autoplays. `AudioContext` constructed **inside** the toggle's click handler.
      Verified in headless Chromium: importing the module constructs nothing, and a page
      loaded with an `armed` preference still has zero contexts until a gesture
- [x] Web Audio API directly — no library. One master `GainNode`, 400 ms linear ramps
- [x] Choice persisted in `localStorage`. `resumeIfArmed()` carries an `armed` preference
      into a new route or visit by arming on the *next* gesture rather than on load — so
      the question is answered once without anything ever autoplaying
- [x] Ducks and pauses on `visibilitychange` — 150 ms duck, then `suspend()`
- [x] Sound reinforces motion: `engine(speed / MAX_SPEED)` from the 5 Hz telemetry callback
      in both flight scenes, each against its own ceiling (17 vs 2.2 m/s); a rate-limited
      tick on component selection in `/lab`
- [x] **An ambient bed after all — synthesised, so still no file.** Six sine partials on
      A3/E4/A4, cent-detuned in pairs so they beat against each other under 1 Hz, through a
      lowpass swept by a 25-second LFO. It evolves without a sequencer and never repeats.
      Starts with the arming, not with the page
- [x] **A volume slider, and half volume by default.** A native `<input type="range">`
      beside the toggle, shown only while armed — persisted separately in `localStorage`,
      scaling `MASTER`, applied on a 120 ms ramp because a slider is direct manipulation
      and a 400 ms fade reads as a broken control. Default 0.5, i.e. -6 dB off the measured
      ceiling below
- [x] **Audible on real hardware.** First tuning measured -54.6 dBFS above 200 Hz while
      hovering — silence on any laptop. Retuned and verified with an analyser tapped into
      the shipped graph: pad -23.8, idle -21.8, cruise -20.1, full speed -15.9 dBFS in the
      reproducible band. A limiter on the master makes clipping structurally impossible
- [x] ~~Loop chosen with the payload rules in mind~~ — **no file at all.** Every voice is
      synthesised: two detuned saws through a speed-driven lowpass, plus filtered noise for
      air. Nothing is fetched, so the payload rules have nothing to constrain
- [x] ~~Licence recorded next to the file~~ — **no file, no licence.** The hard gate is met
      by having nothing to license, not by clearing it

**Done when:** a visitor who never touches the toggle hears nothing and loads nothing. ✅
Verified 2026-09-04 by a 14-assertion headless harness (`no AudioContext on import`,
`engine/tick inert while muted`, `no context on load despite armed pref`, …), plus a
measured sweep confirming tone 0.012→0.062, air 0→0.045 and cutoff 170→1658 Hz across
speed 0→1.

---

#### 8.8 — Consolidation

- [ ] Delete the ad-hoc styles each of the above replaces — the phase is not done while both
      the old and new way exist
- [ ] Re-run the §8 guardrails in `DESIGN-LANGUAGE.md` in full
- [ ] Record the new per-route numbers in §6 of this file
- [ ] Re-read `DESIGN-LANGUAGE.md` and correct anything the build proved wrong. A design doc
      that survives implementation unedited was not specific enough

**Guardrails, re-checked before each sub-phase ships:**
per-route JS measured in headless Chromium with one fresh context per route (`/lab` must still
reproduce 1,402 KB or the harness is lying) · content routes under ~475 KB and three.js-free in
the initial graph · nothing on the render path fetches from a network, fonts and decoders
included · `prefers-reduced-motion` verified by hand · keyboard path intact through every new
control, audio toggle included · both themes checked · WebGL-disabled and JS-disabled still
show full content.

**Not doing, and why:** shader-drawn text — it costs the SEO, the MDX pipeline and the
accessibility story that are the whole point of the content layer. Scroll-jacking. A preloader
on a content route. Audio anywhere outside the 3D routes. Igloo can make all three of those
choices because it has no long-form text and no recruiter reading it on a train.

**Phase done when:** a stranger landing on `/` knows who you are in five seconds, scrolls
through work that reveals itself as one continuous surface, and arrives at a door they choose
to open — with the homepage no heavier than it is today.

---

### Phase 9 — Diegetic world
*Goal: the world stops borrowing the website's furniture. Zone information is delivered by
something that exists inside the scene, and getting there is guided rather than magic.*

**Reference:** [`DESIGN-LANGUAGE.md`](./DESIGN-LANGUAGE.md) §9.

**Both gates are now met** — 8.2 landed 2026-08-24 and the Android pass passed the same day.
The reasoning is kept because it still governs how much this phase may spend:

**Runs after Phase 8.2** (which produces `ConsoleCard`) **and after the mid-range Android pass
still outstanding from Phase 2.** That ordering is not negotiable: `/explore/lab` sits at
4.57 MB against a 5 MB budget with little room, and `/explore` at 1,467 KB JS + 460 KB of
models. Adding kiosks, a particle system and a DOM-in-3D layer to a scene that has never been
measured on its target device means debugging a frame rate with three new suspects in it.

---

#### 9.1 — The panel stops looking like a website

*Cheapest fix, largest share of the "feels out of place" problem, no new geometry.*

- [ ] Restyle the zone panel as an instrument readout on the `ConsoleCard` primitive — docked
      to the console frame, not a card floating in space
- [ ] Same treatment for `/lab` hotspot callouts, so the two scenes agree
- [ ] Keep the custom `calculatePosition` clamp — it exists because drei's default put the top
      of every panel off-frame at exactly the moment you arrived to read it

**Done when:** nothing in the world is wearing site chrome, and no geometry was added.

---

#### 9.2 — Waypoint ribbon

- [ ] A catmull-rom of additive points from the craft to the selected zone, in the accent.
      Tier B particles — one buffer geometry, animated by a time uniform, not per-particle JS
- [ ] The existing jump buttons fly the craft **along the ribbon**; auto-flight is interrupted
      the instant the visitor touches a control
- [ ] `prefers-reduced-motion` → instant reposition. **This is where teleport belongs** — as
      the accessible branch, not as the default
- [ ] The ribbon is drawn before the flight starts, so the button's effect is legible rather
      than magic

**Not doing: teleport as the default.** Spatial memory is the entire payoff of flying rather
than clicking; a cut means you never learn where anything sits relative to anything else, and
it breaks the single-continuous-space principle the whole design leans on.

**Done when:** you can always see where you are being taken, and you can always take over.

---

#### 9.3 — Kiosks, and the arena question

*Size follows content. The arena is not enlarged on a hunch — one kiosk decides it.*

- [ ] **One** kiosk/screen model, instanced at every zone. Not nine models. Pipeline entry +
      `LoadedModel`, in the schematic language, per [[asset-pipeline]]
- [ ] Place it at a single zone first and fly the world. **That measurement decides whether the
      arena grows** — an enlarged empty world is emptier, and today's fog (60–190 against a
      120-unit world whose diagonal is ~170) means anything past the current bounds is grey.
      At 17 m/s the world already crosses in ~7 s, which is right for nine destinations
- [ ] If it does need room, prefer **vertical** distribution — the flight volume is 1.2–34 and
      almost unused — over widening the plate
- [ ] Docking swaps the control legend, extending the `/explore/lab` terminal pattern rather
      than inventing a second one. Every station keeps its plain button under the canvas

**Done when:** a zone is a place you arrive at, and the arena's size was decided by flying it.

---

#### 9.4 — Screens that are still text

*The one thing this phase must not break.*

- [ ] Zone body copy renders as **DOM on the screen's face** — drei `<Html transform occlude>`
      — not as a canvas texture or an SDF atlas. It looks like a hologram and it is still real,
      selectable, indexable, screen-reader-reachable text
- [ ] The screen billboards to face the visitor on docking; reading a paragraph on an angled
      plane at world scale on a phone does not work
- [ ] Verify by curling the route and grepping for the copy, exactly as the `<details>` block
      was verified on 2026-08-22
- [ ] Measure: DOM-in-3D at nine zones is the risk in this phase. Mount only the docked one

**Not doing: text baked into the scene.** Igloo draws its type in shaders and pays for it in
SEO and accessibility; it can, having no long-form content. Ours is derived from the same MDX
the project pages read, and the rule from 2026-08-22 stands — the world cannot say something
the site does not, and a visitor with WebGL off gets every word. Phase 6 gates on "real text,
not baked into canvas".

**Done when:** the panel looks like a hologram and `curl | grep` still finds every word.

---

**Phase done when:** flying to a project feels like arriving somewhere, and turning WebGL off
still gives you the whole portfolio.

---

## 4. Decision log

Append here whenever a non-obvious call gets made. Format: date — decision — why.

- **2026-09-23** — **Phase 7 (optional AWS artifact) is dropped.** Decided by Suhan: it will not be done. It was always optional and off the render path, so nothing else depends on it.
- **2026-09-23** — **The keeper simulation shows the estimator, not the vision.** `/lab/keeper` is the RoboKeeper counterpart to `/lab/ascilam`, and the same rule applies: show the thing that is hard to explain in prose, and say plainly what is faked. The hard part here is **prediction from two noisy points**, so the page models the ball ballistically, takes exactly two gate sightings with Gaussian error (depth 1.5× the image axes, as a structured-light camera behaves), and runs both estimators the project compared — the six-state EKF with gravity in the motion model, and the straight line through the two points. The **detection** half is deliberately not modelled: no YOLO in a browser, no missed frames, no motion blur. A visitor cannot learn from a fake detector, and pretending otherwise would be the one thing the ASCILAM page refuses to do.
- **2026-09-23** — **The servo has a top speed, which is why the near gate is a slider.** Without a slew limit the page would have exactly one lesson (gravity), and a keeper that teleports to the right answer makes the gate placement look free. `ARM_SLEW` is 360°/s, an MG996R-class figure, and the arm returns to neutral at each kick — otherwise a keeper left near the previous prediction gets accidental saves and the reaction-time readout flatters itself. The outcome now distinguishes `missed-prediction` from `too-slow`, which is the distinction the sliders exist to make visible.

- **2026-09-03** — **Every markdown document except `README.md` moved into `docs/`.** `ARCHITECTURE.md` and `PLAN.md` sat in the repo root next to `docs/`, which already held two other documents — so "where is the writing" had two answers and the split tracked nothing but the order things were written in. The root is now for files a tool reads (configs, `package.json`, `LICENSE`); prose is in one directory. `README.md` stays at the root because GitHub renders it as the landing page, and it now carries an index of the four documents rather than two links. Moved with `git mv` so the history follows. Cross-references updated in both directions: `PLAN.md`'s links lost their `./docs/` hop, and the handful of code comments pointing at `PLAN.md` (`next.config.mjs`, `src/app/layout.tsx`, `.gitignore`) gained one. **No build input moved** — nothing in `src/`, `scripts/` or CI reads a markdown file.
- **2026-09-03** — **Leaving the world returns a deep-linked visitor to where they were, not to `/explore`.** The corollary of the `?fly=1` door above. A visitor who navigated to `/explore` themselves *is* at `/explore`, and Escape correctly drops them onto the page they chose, still flying inline. A visitor who pressed `▸ Take control` at the bottom of `/` never chose that page — to them it is the back of the room the door opened into, and being left standing in it is the same disorientation as the double gate was. `Explorer` therefore watches `immersive` going false (**not** a click: Escape, F11 and the system chrome all leave fullscreen on their own) and, when `deepLinked` is set, calls `router.back()`. `back()` rather than `push('/')` because only a history traversal restores scroll — a push lands them at the top of the home page, five chapters above the portal they left from. Verified: the returned view is pixel-identical to the one they left. A `?fly=1` URL opened directly in a fresh tab has nothing behind it and falls back to `/`. The fullscreen hint reads `esc to go back` in that case and `esc to leave fullscreen` otherwise, because they now do different things.
- **2026-09-03** — **The portal's `Take control` deep-links with `?fly=1`, because one door asked to be opened twice.** 8.6 made the portal a `<Link>` to `/explore` rather than an in-place mount, on measurement. What that quietly shipped was two gates in a row: the visitor pressed `▸ Take control` on `/`, landed on `/explore`, and found a button with the same two words waiting for a second press — which reads as the first press having failed, not as a second choice being offered. `HomePortal` now links to `/explore?fly=1` and `Explorer` calls `takeControl()` on mount when that param is present. **The gate is not weakened, it is relocated to the click that already expressed the intent:** `/explore` from the nav, or typed, still shows its gate, and nothing 3D is in `/`'s graph either way. Read via `window.location` in an effect rather than `useSearchParams()`, which would opt the route out of static prerendering unless wrapped in Suspense. The fullscreen request now rides the navigation's activation instead of a local click and a browser may refuse it; `useImmersive` already treats refusal as the fixed-overlay case, so the canvas fills the viewport either way.
- **2026-08-24** — **Zone information stays real text, delivered by diegetic furniture.** The floating HTML panel does read as the website intruding on the world, and the proposed fix — baking the copy onto a 3D screen or hologram — would have cost the indexing, the screen-reader path and the plain readability of a paragraph on an angled plane at world scale on a phone. Phase 9 splits the two halves: the *frame* becomes diegetic (a kiosk model, an instrument readout on `ConsoleCard`), the *text* stays DOM via drei `<Html transform occlude>`, mapped into 3D space and occluded by geometry but still selectable and still in the server HTML. Looks like a hologram, loses nothing. Upholds the 2026-08-22 rule that the world cannot say something the site does not.
- **2026-08-24** — **Guided flight along a waypoint ribbon, not teleport.** A cut destroys spatial memory, which is the entire reason to fly a world rather than click a list, and it breaks the single-continuous-space principle. The ribbon also fixes a real navigation problem — in a fogged world you cannot see where anything is, so the jump buttons currently read as magic. Teleport is kept, but as the `prefers-reduced-motion` branch, where an instant reposition is the correct behaviour rather than a shortcut.
- **2026-08-24** — **The arena is not enlarged on a hunch.** Fog is 60–190 against a 120-unit world whose diagonal is ~170, so the far corner is only just visible today; widening the plate would add travel through grey, and an empty world enlarged is emptier. At 17 m/s it already crosses in ~7 s, which is the right order for nine destinations. Size follows content: build one kiosk, place it at one zone, fly it, and let that decide. If room is needed, the flight volume of 1.2–34 is almost unused — go up before going out.
- **2026-08-24** — **The home page became a guided sequence, and a crossfade was the wrong animation for it.** The obvious reading of "items appear while previous items disappear" is a dissolve, and it was built that way first: overlapping ranges, both chapters legible at once. It looked like a fault — two paragraphs of prose interleaved on the same surface, neither readable. The shipped version hands off *sequentially*: the outgoing chapter clears, then the incoming one arrives, over about 330px of scroll. A short beat reads as intent; a collision reads as a bug.
- **2026-08-24** — **Each chapter needed its own sticky runway — and that architecture cannot produce a handoff at all.** Consecutive runways are separated by a viewport of ordinary scrolling, so a chapter physically slides off the top while the next slides up from the bottom, whatever the opacity does. The fix is structural: ONE pinned stage with all chapters stacked absolutely on it, so nothing moves relative to the viewport during a transition and only opacity changes. Anything built on the per-chapter-runway model will have this bug.
- **2026-08-24** — **On a stacked stage every link is permanently "in viewport", so Next prefetched all of them.** `/` measured 515 KB against 462 KB for every other content route: the faded-out chapters are still inside the viewport box, so the lab links and the portal were prefetching four route chunks at page load. `prefetch={false}` on those brings it back to **462 KB**. `/projects` keeps its prefetch, being cheap and the likely next stop. This is the second time this session that Next's viewport prefetch quietly moved a budget — worth checking on any page whose links are not where they appear to be.
- **2026-08-24** — **`Explore` in the nav carries `prefetch={false}` for the same reason.** The title bar is above the fold on every page, so a prefetched `/explore` would have put its route chunk on every single page load site-wide — undoing exactly what removing the hero link achieved in 8.6.
- **2026-08-24** — **A fifth nav item does not fit a phone, measured at 449px of content in a 390px bar.** Rather than drop a destination, the row is tightened below `sm` (13px type, 1.5 padding, 0.5 gap) and scrolls horizontally under 340px. Every destination stays reachable at every width.
- **2026-08-24** — **The chapter animation carries `pointer-events`, not `visibility`.** Stacked chapters all occupy the same surface, so a faded-out one would otherwise swallow clicks meant for the one that replaced it. `visibility: hidden` would fix that and take the chapter out of the accessibility tree with it — which is the one thing this design promises not to do. `pointer-events` animates discretely in the keyframes and leaves the a11y tree alone.
- **2026-08-24** — **The portal is a link, not an in-place mount, and measurement decided it.** §6.5 left this open as "an implementation choice, not a design one", preferring in-place for continuity. 8.5 then established that any client component on a content route costs ~2 KB on *every* route, and the `next/dynamic` loader another ~3 KB — so an in-place mount would have spent ~5 KB site-wide to avoid a page navigation. The gate is identical either way: nothing 3D loads until the visitor clicks. `useImmersive` still owns the fullscreen behaviour on `/explore`, unforked.
- **2026-08-24** — **Moving the door to the bottom of the page made `/` 16 KB lighter, and explains the budget anomaly.** `/` measured 478 KB against 462 KB for every other content route, and the drift was blamed on unknown history. The cause was the hero's "Or fly through it →" link: Next prefetches links **in the viewport**, so `/explore`'s route-entry chunk was fetched on every single homepage load, by every visitor, whether or not they ever intended to fly. With the only door now at the end of the scroll, `/` loads at **462 KB** — in line with the rest of the site — and rises to 478 KB *only once the visitor scrolls to the portal*, which is exactly when a warm next page is wanted. Verified both ways. **The gate applies to the prefetch too, and that was an accident of layout, not a plan.**
- **2026-08-24** — **The portal's poster is a real screenshot of the built scene, not artwork.** Captured headless from `/explore` under SwiftShader with the DOM overlays hidden, cropped and encoded to two WebP files. It shows the actual visual language — unlit teal wireframe world, PBR craft, marker rings — which no illustration would have got right, and it cannot flatter the scene beyond what the scene does. The cost of that honesty is that it goes stale: **re-shoot when the world changes.**
- **2026-08-24** — **A client component's cost is not local, which killed the canvas particle field.** Measured A/B on one build: adding a single `'use client'` component used by *one* content route put +2 KB on **every** route, `/lab` and the case studies included, because the client module joins the shared graph. `next/dynamic` was tried as the fix and made it worse — +5 KB, the loader machinery landing in the same shared chunk. The field was rebuilt as a **server component**: seeded `<span>`s positioned at build time, animated entirely in CSS, 0 KB, and `/lab` back to exactly 1,402 KB. General rule now: on a content route, reach for a client component only when the behaviour genuinely cannot be expressed in CSS — and price it across the whole site, not the page you are on.
- **2026-08-24** — **An inline `animation-duration` cannot be overridden by any stylesheet rule.** The per-mark duration was inline (it varies per mark), so `body:has(input:focus) …` silently did nothing — the quicken-on-focus effect measured 10.9 s both idle and focused. Fixed by making the inline value a **custom property** (`--pf-dur`) and having the stylesheet compute `calc(var(--pf-dur) * var(--pf-speed, 1))`; the `:has()` rule then sets `--pf-speed` on the *container*, which inherits down and is not shadowed by anything inline. Worth remembering: inline styles beat selectors, but inherited custom properties route around that.
- **2026-08-24** — **The field lives in the margins and not below 900 px.** Scattered across the full width it put 1 px accent ticks next to paragraphs, which reads as a rendering bug on a page claiming engineering rigour. It is now confined to the bands outside the reading column, and on narrow viewports — where the column *is* the screen — it does not render at all. This also discharges the "measure body-text contrast with the field on" guardrail by construction rather than by measurement: the field is never behind text.
- **2026-08-24** — **8.3 parked: View Transitions are not free in this stack.** `react@19.2.8` — current stable, and what this repo runs — does not export `unstable_ViewTransition`, which is what Next's `experimental.viewTransition` flag drives; the flag needs a React canary. The CSS `@view-transition` rule only fires on cross-document navigation, which the App Router does not do. So the phase's "0 KB" claim was wrong on the facts. Rather than take a React canary — the same trade refused for r3f over a console warning — 8.3 waits for a stable `ViewTransition`. Recheck on any React upgrade.
- **2026-08-24** — **The scroll reveal ships with no JavaScript fallback, on purpose.** 8.4 called for an `IntersectionObserver` fallback for browsers without `animation-timeline`. Building it would have put a client component on every content route so that a *decoration* could work everywhere — trading the phase's entire premise for a fade. A browser without support shows the content immediately, which is the right answer anyway. The reveal is an enhancement, and enhancements are allowed to be absent.
- **2026-08-24** — **`.rise` goes on cards, headings and chrome; never on prose.** A view-timeline reveal is a genuine scrub — the element moves as you scroll through its entry range — so applying it to a paragraph is precisely the "never move the reader's content under them" rule the design doc sets. Case studies therefore get **no** reveals at all: their only animated element is the progress rail, which is `aria-hidden` chrome.
- **2026-08-24** — **The rail is hidden rather than frozen under reduced motion.** Its base state is `opacity: 0`, and the enhancement block turns it on. Left to the blanket reduced-motion rule, the time-based fallback would have run it to completion and left a permanent full-width accent bar across the top of every case study — a decoration that looks like a border and means nothing.
- **2026-08-24** — **The site publishes the professional address only.** Both `sansikawaduge@` and `sansikasuhan5@` are real; the first is professional and the one printed on the CV, the second personal. `site.email` is the professional one, which fixes the mismatch between the site and the document a recruiter is already holding. The personal address is not on the site at all — one public contact point.
- **2026-08-24** — **The portrait is a plain `<img>` with a hand-built `srcset`, not `next/image`.** `next/image` routes every request through Vercel's optimiser: a quota, a network hop, and a service on the render path of a site whose architecture is "nothing on the render path can break". The two files are pre-cropped and pre-encoded at exactly the sizes the site renders (88 px and 128 px, so 256 and 512 for 2×), 8 KB and 21 KB, so there is nothing left for a runtime optimiser to do. `width`/`height` are explicit — a portrait that pops in and shoves the fields down is a layout shift on the one element above the fold.
- **2026-08-24** — **The source photo was cropped to head-and-shoulders, not merely scaled.** It is a half-body shot; at 88 px the face would have been a smudge. The crop also removes most of a bright purple circuit-board backdrop that fights the site's palette — which is a real consideration but the secondary one. The original is untouched on Drive; the crop rectangle is recorded in the build note below in case it needs redoing.
- **2026-08-24** — **The measuring harness was wrong twice, and the honesty check caught it both times.** It counted CSS chunks under `/_next/static/chunks/` as JS (uniform +40 KB on every route), and a 3.5 s settle was too short for three.js to arrive (`/lab` came out at 456 KB once). Filtering on `.js` alone with a 9 s settle reproduces the 2026-08-23 figures **exactly** — `/lab` 1,402 KB, `/lab/ascilam` 1,395 KB — which is what makes the rest of the numbers usable. The earlier note about "two incompatible harnesses" is superseded: there is one harness, it was mine that was broken.
- **2026-08-24** — **The EDUCATION line is copied from the CV, minus the parts the CV does not claim.** It reads `BSc Eng, Computer Science & Engineering · Univ. of Moratuwa` — no `(Hons)`, because the CV does not say Hons, and no expected graduation year, because the CV says `Aug 2022 – Present` and inferring 2026 or 2027 from a start date is a guess about someone's life. Add the year to `site.education` when it is certain. Availability is `Open to graduate roles and internships`, which is Suhan's own stated intent, and carries a comment saying to delete it the day it stops being true.
- **2026-08-24** — **A wrapping value used to leave the leader as a stub under the label.** `self-end` put the dotted rule at the bottom of the wrapped block, which read as a broken line rather than a leader — visible the moment the EDUCATION row landed and wrapped to two lines on desktop. It is baseline-aligned with a `translateY` instead, so it sits on the first line and simply runs short.
- **2026-08-24** — **The console card's unknown fields ship as `null`, not as plausible text.** The card wanted EDUCATION and STATUS and the repo holds neither — it knows "undergraduate at the University of Moratuwa" and nothing about a department, a graduation year, or whether Suhan is currently looking. Rather than write a convincing degree title, both are `site.education` and `site.availability`, `null`, and `ConsoleField` renders nothing for a null value. Exactly the `site.cv` / `socials.linkedin` convention from 2026-08-21, and the whole reason the field-card idea is safe to borrow from a page that lists a fictional operator's favourite meal.
- **2026-08-24** — **`StatusBadge` was not reused for the STATUS row, deliberately.** 8.2 said to. `StatusBadge` is typed to `ProjectStatus` — `in-progress` / `complete` / `archived` — which describes a *project's* build state. An availability line is not that, and widening the type to carry both would have made one component mean two unrelated things for the sake of not writing a `<span>`.
- **2026-08-24** — **The dotted leader is a `repeating-linear-gradient`, not `border-dotted`.** CSS dotted borders render as a near-solid hairline at 1 px in both themes — visible in the first screenshot pass, where the leader read as a plain rule. The gradient gives explicit control of dot and gap. Below `sm` the leader is hidden entirely and the row stacks: at 390 px the role wraps to two lines and a leader becomes a stub pointing at nothing.
- **2026-08-24** — **My measuring harness is not the 2026-08-23 harness, and their numbers must not be mixed.** Mine reads ~40 KB higher on *every* route including ones this session never touched (`/lab` 1,442 KB against the recorded 1,402 KB), which by §6's own honesty check means it is not reproducing that baseline — most likely because it counts the chunks Next prefetches for in-viewport links. It is still valid for **deltas measured within itself**, which is how 8.2's +1 KB was obtained: same harness, same build, one tree with the change and one without. Absolute budget claims must come from a harness that reproduces 1,402 KB.
- **2026-08-24** — **`data-scroll-behavior="smooth"` added to `<html>`.** Next 16 warns because it cannot suppress our `scroll-behavior: smooth` during a route transition without it — so a navigation would *animate* the scroll to the top of the new page instead of arriving there. This becomes load-bearing in 8.3, where view transitions and a smooth-scrolling document would otherwise fight each other.
- **2026-08-24** — **The `THREE.Clock` deprecation warning is upstream and cannot be fixed here.** `Clock` is deprecated as of three r183 (we run 0.185.1) and `@react-three/fiber` 9.7.0 — the current stable, verified against npm — still does `clock: new THREE.Clock()` inside its store. Only the 10.x canaries move off it, and a canary r3f is not a trade this project makes for a console warning. What *was* fixed is our own coupling: `World.tsx` accumulated `delta` into a ref instead of reading `state.clock.elapsedTime`, so nothing of ours depends on an API that is scheduled to disappear. Re-check when r3f 10 goes stable.
- **2026-08-24** — **Two "findings" during that check were the harness, not the site**, and both are the same mistake §6 already warns about. A shared `page` across two `goto`s attributed `/explore`'s model requests to `/`, which looked exactly like the homepage pulling 460 KB of GLB it does not need; and a model 404 (caused by tarring the source without `public/models`) threw during render, React fell back to client rendering, and `data-scroll-behavior` vanished from `<html>` — which looked exactly like the fix not working. With a fresh context per route and the models present, `/` requests no models at all and the attribute is present on both routes. **Give every route its own context, and never diagnose from an incomplete copy of the tree.**
- **2026-08-24** — **The motion token is `--ease-console`, not `--ease-out`.** Tailwind v4's `--ease-*` theme namespace *generates* utility classes, and `ease-out` already exists — defining `--ease-out` would have silently redefined every existing `ease-out` in the codebase from underneath. The plan's original name was wrong for this framework; the value is unchanged.
- **2026-08-24** — **`--measure` lives in `:root`, not `@theme`.** Tailwind v4 drops theme variables that no utility references, so declaring it in `@theme` emitted nothing at all — caught by grepping the built CSS rather than by reading the source. Anything defined for later use, before a utility consumes it, has to go in the plain `:root` block with the colour tokens.
- **2026-08-24** — **The blanket `prefers-reduced-motion` rule is kept as a floor, not replaced.** The real branch is the token collapse plus `animation-timeline: none`, which renders scroll-driven animations at their *end* state instead of at speed zero. The `!important` sledgehammer stays underneath it for anything not yet routed through the tokens. This also fixes the authoring rule for 8.4: a reveal must be visible-by-default with the animation subtracting the start state, or it disappears for reduced-motion users.
- **2026-08-24** — **No new type scale.** Tailwind's default scale already is a single coherent scale; adding a second in `@theme` would have been the disorganisation Phase 8 exists to remove. Recorded because "define a type scale" was written into the phase and then deliberately not done.
- **2026-08-24** — **The site's incoherence is a metaphor gap, not an effects shortage.** Three reference sites were studied (Igloo Inc, IRIS K, Chrome Tattoo Paris) and the finding was the same in all three: each is coherent because one metaphor governs every surface — a frozen landscape, a music museum, a terminal you are logged into. Ours already exists and is half-built — the instrument schematic / flight console of `/explore` and `/lab` — and the content routes do not speak it at all. Phase 8 exists to close that gap. Full study and rules in `docs/DESIGN-LANGUAGE.md`.
- **2026-09-04** — **Volume is a separate persisted value, not a re-tune.** "Too loud" could have been fixed by lowering `MASTER`, which would have been the third time these levels were guessed at from one machine. Instead `MASTER` is now explicitly the *ceiling* — the measured -15.9 dBFS figure is what you get at volume 1 — and a persisted 0–1 multiplier sits under it, defaulting to 0.5. The numbers in DESIGN-LANGUAGE §4.6 stay meaningful because they describe a fixed maximum rather than a moving default, and the visitor's own preference is what varies. The slider is a native range input with the fill drawn as a background gradient rather than a second element, which is what keeps arrow keys, Home/End and the screen-reader value working without writing any of it.
- **2026-09-04** — **`readVolume()` distinguishes a stored 0 from a missing key.** `Number(localStorage.getItem(k))` is 0 when the key is absent, and 0 is a legal volume — so a falsy check would silently reset anyone who dragged the slider to silence back to half volume on their next visit. The guard is on `getItem() === null`, not on the number. This is the same trap the contact form's spam timing check fell into on 2026-08-22, which is why it is worth writing down twice: **`Number(null)` is 0, and 0 is usually a real value.**
- **2026-09-04** — **A synthesised pad was added, and the first tuning of everything was inaudible.** Two separate faults, found because "I can't hear anything" was reported against a build where both were true. The first was scope: synthesis-only was chosen over a licensed loop, which was right, but it left nothing at all playing while hovering — correct by the letter of §4.5 and wrong as an experience, so there is now an ambient bed (six sine partials, A3/E4/A4, cent-detuned in pairs, lowpass swept by a 25 s LFO) that starts on arming. The second was a real bug: **sine partials have no harmonics, so the fundamental is the only thing there is to hear**, and the pad was originally written on A2/E3/A3 (110–220 Hz) — under the ~200 Hz wall below which a laptop speaker reproduces essentially nothing. No amount of gain fixes that; the pitch had to move up an octave. The engine escaped the same fate only because a sawtooth carries harmonics well above its fundamental, though its first tuning (46 Hz behind a 170 Hz lowpass at 0.012 gain) measured -54.6 dBFS above 200 Hz and was inaudible for the adjacent reason. Lesson worth keeping: **for synthesised audio, measure the band the speaker can actually produce, not the overall RMS** — the two differ by 20 dB here, and only one of them predicts whether a visitor hears it.
- **2026-09-04** — **A limiter sits between the master and the destination.** Three voices can coincide — pad, engine at full speed, tick on top — and the measured peak at full speed was already -1.7 dBFS before the tick. One `DynamicsCompressorNode` at -6 dB / 20:1 makes clipping impossible by construction rather than a property to re-verify every time a level is tuned. Levels were raised roughly 9 dB in the same pass, so this is not theoretical headroom.
- **2026-09-03** — **The audio is synthesised, so there is no file and therefore no licence.** The plan specified a 60–90 s seamless loop at 96–128 kbps mono, lazily loaded, with its licence recorded in the repo as a hard gate. Every voice is generated instead — two detuned sawtooth oscillators through a lowpass that opens with speed, plus band-filtered white noise for air, and a 140 ms sine blip for the tick. This satisfies three separate constraints at once rather than trading between them: nothing is fetched, so the payload rules have nothing to police and the lazy-loading question disappears; the licence gate is met by having nothing to license; and the sound is *derived from* `telemetry.speed` rather than played alongside it, which is what §4.5 actually asks for — a loop can accompany motion but cannot reinforce it. The cost is that there is no music, which was never the goal: §4.5 explicitly rules out "a bed playing regardless of what the visitor is doing".
- **2026-09-03** — **`resumeIfArmed()` is how "answered once" and "never autoplays" coexist.** The two rules conflict on a fresh load: the preference says armed, and no browser will build an `AudioContext` outside a gesture. Reading the preference and playing would be autoplay; ignoring it would ask the question on every route. So an `armed` preference attaches a one-shot `pointerdown`/`keydown` listener that arms inside that gesture — and on `/explore` that gesture is almost always TAKE CONTROL, so the sound arrives with the flying. Anyone who has never armed audio gets no listener at all, and the guarantee holds literally: zero contexts, zero bytes.
- **2026-09-03** — **The audio toggle lives top-left, not with the other overlay buttons.** The jump list at top-right only exists in fullscreen and bottom-left carries telemetry there, so both corners are conditional. §4.2 asks for a control that is *always* visible, which is a stronger claim than "visible in the mode that has room for it" — top-left is the only corner occupied in every state of both flight scenes. `/lab` has no canvas overlay at all, so it gets a chrome row above the scene and the toggle switches to theme tokens; a hardcoded dark pill on a light page reads as a leftover.
- **2026-09-03** — **The rail is derived from the reading column, not a percentage of the viewport.** A percentage rail (11%, then 15%) clears the text at 1440px and sits *on* it below ~1150px, because the free margin shrinks with the viewport while the rail grows into it — so the "field never touches the reading column" guarantee had been false at narrow desktop widths the whole time, and nobody had rendered it at 1200px to find out. The rail is now `calc((100vw - 48rem) / 2 - 20px)` — literally the space left over beside `max-w-3xl` — marks are placed as a fraction of it from their own edge (`left` for the left rail, `right` for the right), and the field is gated at ≥1200px instead of ≥900px. Verified at 1200 and 1920.
- **2026-09-03** — **The `/projects` lattice is square cells, and a grid may not have partial ones.** The first version spaced its rules at `100% / 6` across a percentage-width rail and `11%` down the viewport: rectangles whose aspect changed with the window, plus a sliced column at the inner edge that read as a clipping bug. It is now 4 columns of a 44px square cell anchored to the outer edge, with an explicit closing rule at the inner edge (a repeating gradient draws the line at the *start* of each cell, so the last column would otherwise hang open) and a mask that dissolves the last two rows, since no viewport is a whole number of cells tall. The tick animation moves in `steps(24)` of exactly one cell for the same reason — on-grid motion or none.
- **2026-09-03** — **In-place animation is not animation.** `/about` and `/projects` shipped with `pf-breathe` and `pf-pulse` animating only scale and opacity. Frame-differencing two screenshots 1.8s apart proved they were running; on screen both read as static, because an opacity fade on a 4px mark is below the threshold of noticing. Both moods now travel — `/about` bobs ±26px while it breathes, `/projects` steps down its lattice — and the frame-difference measurement is now part of how this field gets checked, since "it animates" and "it looks animated" turned out to be different claims.
- **2026-09-03** — **The particle field was invisible, and the fix was measurement, not taste.** Two moods shipped at 14–16 marks total, 1–2px, 0.28–0.3 opacity — below the threshold of noticing on any screen, which is the same as not having shipped it. Screenshotted both themes at 1440px before and after: counts are now per-rail (equal on each side, rather than a coin flip per mark that routinely left one margin empty), marks are 3.5–12px, opacities 0.6–0.75, and the rails widened 11% → 15%. All four content routes now have their own mood per DESIGN-LANGUAGE §5.2 — `/` rising dust, `/about` breathing motes, `/projects` a pulsing lattice, `/contact` accent streaks — so the margin tells you which page you are on. `/projects/[slug]` still gets none. Still a server component, still 0 KB of JavaScript, still nothing inside the reading column.
- **2026-09-04** — **Supabase moved Database Webhooks out of the Database section and under Integrations.** Half an hour was spent looking for a tab that no longer exists, and this runbook was one of the guides confidently pointing at the old place. The underlying object never changed — it is still a trigger calling `supabase_functions.http_request()` through `pg_net` — so the durable route is the SQL, now recorded in the runbook's §3c. That trigger is deliberately NOT a migration file: it carries the shared secret in its header argument, and `supabase/migrations/` is tracked. It is the one piece of this setup that lives only in the dashboard, on purpose.
- **2026-09-04** — **Contact notification goes to Discord, not email.** Resend is the better design for a site that owns a domain; this one does not yet, so the sender would have been stuck on `onboarding@resend.dev` — deliverable only to my own signup address — until Phase 6 resolves that. A Discord incoming webhook is a URL you POST JSON to: no bot user, no gateway connection, no token to rotate, no sender to verify, one secret instead of three. **The cost is `reply_to`:** the email version made answering one click from the notification, and Discord does not linkify `mailto:`, so the address is selectable text and answering means pasting it into a mail client. Named here because it is the one thing the email path did better, and because the trade is reversible — the shape is unchanged (same trigger, same function, notification still strictly downstream of the write), so reinstating Resend is one function body and a secret swap. Also note the embed escapes markdown rather than HTML now, and sets `allowed_mentions: {parse: []}` — the message is a stranger's text rendered in a channel I read quickly and trust.
- **2026-09-04** — **Vercel resolves environment variables at deployment creation, not at request time**, and an earlier line in the runbook said the opposite. Both Supabase variables were saved and the deployed form went on returning `unavailable`, because the running deployment had been built before they existed and keeps whatever the environment held then. A redeploy fixed it and the first real submission reached the table. Second trap in the same shape: a hashed deployment URL (`portfolio-lake-delta-<hash>.vercel.app`) is pinned to one build, so it will show the `mailto:` panel forever no matter how often you redeploy — a redeploy creates a *new* deployment at a *new* URL and moves the alias. Test the alias.
- **2026-09-04** — **The contact route's silence is diagnostic.** The unconfigured branch returns 503 with no log line, while both Supabase-side failures log `[contact] insert failed:` or `[contact] insert threw:`. That was not designed as a debugging aid but works as one: in Vercel's logs, silence on `/api/contact` means the variables never reached the function, and a log line means they did and the database refused. Worth keeping the asymmetry if that code is ever refactored.
- **2026-09-04** — **The keep-alive workflow's seven red runs were a missing secret, not a bug.** Every failed run carried the annotation it was designed to carry — *SUPABASE_URL / SUPABASE_ANON_KEY repository secrets are not set* — and exited in 3 seconds without touching the network. The trap is that the values existed in two other places by then (`.env.local`, and Vercel's environment), and neither is visible to a GitHub runner: **Actions secrets are a third, separate store.** Worth keeping because the same shape recurs for every CI credential. Also the argument for the up-front guard clause: without it the run would have failed on a curl against `https:///rest/v1/rpc/healthcheck` and blamed the database. Run #9 green, 2026-09-04.
- **2026-09-03** — **`--border` was rejected as a particle colour after measuring it.** The mood table specified it for `/projects`; against `--bg` it is ~1.1:1 in *both* themes, so the ticks simply were not there. Ticks moved to `--accent` (which also stops `/projects` being a second grey field next to `/about`), and the lattice they sit on is `color-mix(--fg-muted 28%)` rather than a token, so it reads the same weight on light and dark ground instead of inheriting a token tuned for 1px borders.
- **2026-09-03** — **The app icon is three static files in `src/app/`, not a generated `icon.svg`.** Phase 6 originally called for an SVG in the schematic language; the crossed-swords mark in `public/icons/` was already the chosen identity, so the work was sizing rather than drawing. Three files because they answer three different questions: `favicon.ico` carries 16/32/48 for browsers that still ask for the ICO, `icon.png` is the 192 px transparent one modern browsers prefer, and `apple-icon.png` is flattened onto `#0b0d10` with 16 px of padding because iOS ignores alpha and would otherwise composite the mark onto plain black and bleed it to the corners. The 256 px ICO layer was dropped (it alone was ~120 KB of a 160 KB file) and `icon.png` is palette-quantised to 128 colours — flat art, visually identical, ~7x smaller. Next generates every `<link>` tag from the filenames, so `layout.tsx` needs no `icons` metadata.
- **2026-08-24** — **The motion stack is dependency-free on content routes.** All three references run Three + GSAP (+ Svelte, + Lenis); our content routes are budgeted at ~465 KB with no three.js. View Transitions (Next 16) and CSS scroll-driven animations (`animation-timeline: view()`) deliver route dissolves, shared-element morphs and scroll reveals at **0 KB**, off the main thread, with `IntersectionObserver` as the fallback. GSAP/Lenis stay permitted inside `/explore` and `/lab`, where the budget already accepts weight. No scroll hijacking on any route.
- **2026-08-24** — **The home page opens with a summary card and ends at a *gated* portal.** `/` gets a five-field `ConsoleCard` above the fold, progressive disclosure on scroll, then a console-boot panel with an explicit `TAKE CONTROL`. The three.js scene is a `next/dynamic(ssr: false)` chunk that mounts **on activation, never on scroll-into-view**. Auto-mounting when the section scrolls into view was proposed and rejected: it pushes ~1.9 MB onto a mid-range Android that did not ask for it, breaks the homepage budget rule outright, and inverts the deliberate-entry etiquette adopted for audio. This is the only qualified exception to "no canvas on the homepage" — nothing 3D may be in `/`'s initial graph. Supersedes nothing in the 2026-08-22 `/explore`-not-`/` decision; it is that decision honoured with a better door.
- **2026-08-24** — **Console card fields must be real.** Chrome Tattoo's profile card carries AGE, PERSONALITY and FAVORITE-MEAL, and it works because the operator is a persona. An engineering portfolio's entire currency is that every claim is checkable, so those fields are dropped rather than adapted — a dry true field beats an invented quirky one. Same reasoning limits junk-glyph noise to one instance per page, away from real content: it reads as texture on a tattoo shop and as a rendering bug on a site claiming rigour.
- **2026-08-24** — **Audio is gated, scoped and never ambient.** Copying IRIS K's etiquette rather than its volume: never autoplays, `AudioContext` constructed inside the unmute gesture, one always-visible `ARMED / MUTED` control, choice persisted in `localStorage`, Web Audio API directly (no library), and scoped to `/explore` and `/lab` only — music under a case study competes with reading. Sound reinforces motion (craft speed, hotspot focus) rather than playing a bed, which is the one thing Igloo's sound design does that is worth copying wholesale.
- **2026-08-24** — **Particles are two-tier and case studies get none.** Tier A is a self-written canvas2D/SVG field under ~4 KB on content routes; Tier B is three.js `Points` inside the existing scenes. Igloo's volumetric, velocity-coloured particles are unaffordable on a content route and off-metaphor besides — ours is instruments, not weather, so the field is telemetry about which page you are on. `/projects/[slug]` gets no field at all: a case study is for reading.
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
- **2026-08-22** — Notification runs on a **database webhook**, not from the site. Notification is therefore downstream of the write: if the notification service is down or misconfigured, the row is still saved and the visitor still sees success. A notification failure must never look like a submission failure. (The service was Resend when this was written and is Discord as of 2026-09-04; the property is what matters, not the vendor.)
- **2026-08-22** — The keep-alive cron calls a `public.healthcheck()` RPC, after the first version — pinging the PostgREST root — turned out to answer **401** to the anon key on this project, which would have failed every scheduled run. A 401 is also useless as a health signal: it is indistinguishable from a wrong key or a dropped grant. And PostgREST serves that root from a cached schema, so it may never touch Postgres, which is the one thing a pause-prevention ping must do. The RPC returns `now()` and nothing else, executes in the database, and a 200 means 200. Requires `0002_healthcheck.sql`.
- **2026-08-22** — Added `vercel.json` pinning `"framework": "nextjs"`. The `e30c5ff` deploy failed with `No Output Directory named "public" found` — not a build failure at all (`next build` completed and generated all 17 pages), but Vercel treating the project as Framework Preset *Other*, which runs the build and then hunts for a folder of static files to serve. Pinning it in the repo makes the setting version-controlled rather than a dashboard checkbox nobody remembers ticking.
- **2026-08-22** — The ASCILAM visualisation shows **2D scans accumulating into an occupancy grid**, not a point cloud. The scouts carry RPLiDAR A1 / STL-19P — 2D sensors — and the coordinator fuses occupancy grids. A 3D point cloud would have looked better to a general viewer and implied hardware that does not exist. The log-odds grid at 5 cm is what the real system actually produces.
- **2026-08-22** — The SLAM arena models **odometry drift explicitly**, and each scout files its scans at its *believed* pose. That one detail generates the whole demonstration: self-consistent-but-wrong local maps, two ghosts that refuse to align when overlaid, and a fused map that means something. Drift is seeded, not random — the unaligned view is a teaching illustration and must not occasionally come out looking nearly correct.
- **2026-08-23** — Phase 3 **unparked and completed**, still out of order, because two real `.glb` files arrived. The parked note said "unpark the moment a real `.glb` needs to ship"; it did, so it was.
- **2026-08-23** — **`/lab` keeps its procedural airframe.** The obvious move was to swap the new quadcopter mesh in, and it was wrong. `Airframe.tsx` is a dimensioned model of *this* build — the Jetson block is 100 × 79 mm because that is the Orin Nano carrier, and there is a frustum drawn at the Gemini 336's real 90° × 65° FOV. The six hotspots in `drone.ts` sit at those component coordinates. The new mesh is a generated ducted hobby quad with prop guards and a strapped LiPo; nothing on it corresponds to any of that, so "NVIDIA Jetson Orin Nano 8GB" would point at a stranger's airframe. Same reasoning as the 2026-08-21 CAD-import decision: the procedural one is honestly this aircraft.
- **2026-08-23** — ~~Both models render schematic, not textured~~ — **revised the same day.** The rule now applies to *scenery only*: the world stays unlit fill plus edges, and the craft you fly is the single PBR object in it. That contrast turns out to do the work the uniform version was trying to do — the one real thing in a drawing of a place is exactly where a visitor's eye should go, and the craft is what they are steering. Scenery still gets textures deleted, which is still where its 99.9% reduction comes from.
- **2026-08-23** — The **VT-802 flies, the quadcopter parks** — the reverse of the first arrangement. The VT-802 has an asymmetric silhouette that reads as a heading from behind, hull markings worth seeing up close, and separately-authored materials; the ducted quad is four-way symmetric and needed a bolted-on nose cone to be flyable at all. Putting the more legible craft under the visitor's hands and the simpler one on the ground was the right way round.
- **2026-08-23** — The craft is **PBR with a generated environment map**, and those are one decision, not two. Metal reflects its surroundings and emits nothing of its own, so a metallic material with no environment renders very nearly black however many lamps you point at it. `RoomEnvironment` prefiltered through `PMREMGenerator` is procedural geometry — code, not a downloaded HDR — so it costs zero bytes on the wire and cannot fail to load, which matters on a site whose architecture is "nothing on the render path can break". The two directional lights on top are for *shape*, not brightness: the environment alone lights the hull evenly, which is legible but flat and makes attitude hard to read while flying.
- **2026-08-23** — Textures are **WebP at 1024, not KTX2**. KTX2 keeps maps compressed in VRAM (~3 MB here against ~24 MB) but wants a `toktx` binary in CI plus a ~250 KB transcoder on the render path, and its ETC1S mode mangles normal maps — a move would need UASTC for that slot specifically. At one textured asset the transcoder costs more than it saves. This is now the closest call in the pipeline rather than a non-question.
- **2026-08-23** — TANGENT is dropped even though normal maps are kept. three derives tangents in the shader when the attribute is absent, which is fine at this scale and saves a vec4 per vertex.
- **2026-08-23** — `gradient_city` **underlies the procedural skyline rather than replacing it**, because the two are doing different jobs. The plate is a regular grid of identical towers — handsome, and completely uniform, which is what you want underfoot and precisely what you cannot navigate by. `Scenery` is seeded and irregular so no two parts of the sky look alike, and it keeps a 12-unit hole in the middle for the spawn point and the first three markers, which a uniform grid cannot. Keeping both gave the world a horizon line it never had.
- **2026-08-23** — The city plate is **squashed to 32% height and tinted dark**. At true scale across 120 units its towers stand ~10 units — straight through the flight volume, so you would fly inside collisionless buildings and markers at y = 4–9 would be swallowed. Flattened, it reads as a city seen from height, which is what a drone at altitude should see. The tint is a multiply into the unlit material: the source is near-white and this world is deliberately dark so the markers and the craft own every bright pixel. Multiply only removes light, so the author's gradient survives, just quieter.
- **2026-08-23** — Environment candidates **measured before choosing, and three of four rejected.** `a_metaverse_bar` floors at ~400k triangles and ~7 MB no matter the budget requested — 3,366 primitives across 68 materials, and the simplifier works per-primitive and cannot merge across a material boundary, so a thousand tiny props are each already at their minimum. `sci_fi_hallway` is 402 MB and 7M triangles: structurally much better (12 materials, 657 primitives, would likely land ~2–3 MB) but it exceeds GitHub's 100 MB per-file hard limit, so it cannot enter the repo at all. `scifi_room_interior` builds fine at 170–262 KB but is an interior. The deeper point: three of the four are rooms, and `/explore` is an open 120-unit world flown at 17 m/s. `gradient_city` was the only flyable exterior, the cheapest by two orders of magnitude, one draw call, and already authored `KHR_materials_unlit` — the site's visual language, for free.
- **2026-08-23** — `models/environments/` is **gitignored**, not adopted as a second raw-asset folder. It is a 467 MB staging area holding a file that cannot be committed under any arrangement short of LFS. Anything that ships is copied into `assets/raw/` first, and only if its source is small enough to live in git.
- **2026-08-24** — The asset manifest **carries no build timestamp**, and the pipeline's determinism is load-bearing. Found on the first real push: `manifest.json` held `builtAt: new Date().toISOString()`, so every CI run produced a diff, the workflow's "assets unchanged" branch could never be reached, and every push touching `assets/raw/` would have committed a rebuild that changed nothing. Verified the rest by rebuilding twice from scratch and comparing hashes — the GLBs are byte-identical, so with the timestamp gone a push that changes no source now produces no commit. Git already records when a file was built. Anything added to that manifest has to be asked the same question: can it vary between runs?
- **2026-08-23** — The lab is a **second scene on its own route** (`/explore/lab`), not a replacement for the open world. The two are different machines: 2.2 m/s in a 14 m room against 17 m/s in a 120 m world, with collision against without. Folding them into one component would have meant a file of conditionals; keeping both means the outdoor world survives and either can earn the front door later.
- **2026-08-23** — Lab objects are addressed by **material name, not node name**. The source's nodes are `Object_2` … `Object_30`, which say nothing; its materials are descriptive (Polish, from the original author) — `Panel_sterowania` the control panel, `drzwi` the door, `szafka_body` the cabinet, `rura_gwna_baza` the tank. Every mesh has exactly one primitive with exactly one material, so material name is a reliable one-to-one handle, and the only one available.
- **2026-08-23** — Hence the `interior` profile **must not merge meshes**. Merging is the pipeline's default and saves draw calls; here it would leave nothing to attach behaviour to. This is the one place a performance optimisation is deliberately switched off for a functional reason.
- **2026-08-23** — Lab textures at **512, not 1024**. Indoors the binding constraint is VRAM, not bytes: the source ships 110 maps, which cost ~380 MB of texture memory at 1024 against ~95 MB at 512. 95 MB is still high and the mid-range Android pass is now the check that decides it — the fallback is dropping normal and metallic-roughness, which takes it to ~54 MB in one edit.
- **2026-08-23** — Collision is **axis-aligned boxes, resolved one axis at a time**. Boxes because at 2.2 m/s the difference between a box and a pipe's true silhouette is centimetres nobody feels, and a physics engine would outweigh the whole scene. Per-axis because resolving all three together and rejecting the result sticks you to any wall you brush; per-axis leaves the other two free, so you slide along the surface instead.
- **2026-08-23** — While the projects terminal is open the **arrow keys drive the list, not altitude** (space and shift still climb). A control that silently changes meaning is bad, so the on-screen legend changes with it. The alternative — a separate modifier — puts a chord between the visitor and the only content on the page.
- **2026-08-23** — The terminal is operable by **click, tap and keyboard**, and every station also has a plain button under the canvas that flies the craft to it. Nothing in the room is reachable only by flying well; the same rule the outdoor jump list follows.
- **2026-08-23** — Four things were extracted to their own files while building the second scene — `Lighting`, `panelPosition`, `useWebGLSupport`, and the model loaders in `LoadedModel`. Extracted rather than copied specifically because the environment map is load-bearing: it should not be possible to write a new scene that forgets it and renders every metal surface black.
- **2026-08-23** — The parked quadcopter is **out of `/explore`**. Its pipeline entry and built 24 KB asset are deliberately left in place rather than deleted, so the model is one line from being placed somewhere again — but it currently has no caller, and neither does `SchematicModel`. If neither finds a home, remove both: unreferenced render code that nothing exercises is the same rot as a CI job with no inputs.
- **2026-08-23** — Taking control goes **fullscreen in both explore scenes**, through one shared hook (`useImmersive`). Standardised rather than copied because every interesting part of it is an edge case, and a second hand-written copy would get one of them wrong. Same frame classes, same overlay button styling, same exit affordance and Escape hint in both.
- **2026-08-23** — Fullscreen, by two routes. The Fullscreen API where it exists, and a fixed-position overlay where it does not — iPhone Safari has never implemented `Element.requestFullscreen` (iPad has), so the one platform where a small canvas hurts most is the one the standard route does not reach. Feature-detected, never browser-sniffed. The request must be made inside the click handler or the browser refuses it as a non-gesture, and the refusal is a rejected promise rather than a visible error.
- **2026-08-23** — The station buttons **follow the canvas into fullscreen**. They are the accessible route to every station, and leaving them behind on a page you can no longer see would have been a regression dressed as a feature. The outer nav is hidden rather than unmounted so focus does not move.
- **2026-08-23** — The lab set is **open-fronted**, like almost every downloadable interior: above y = 2 it has walls only at z = -7 and x = 11, so from most of the room you look out through a hole and the canvas shows through as black. `RoomShell` closes it with a dark inward-facing box and a schematic grid. Drawn on **all six faces**, not just the two that are missing — the real walls are in front of it and hide it, so this cannot fall out of step if the room is ever re-exported. Enumerating the gaps instead would be a list that silently goes stale. The drone could never reach the openings anyway; `ROOM.bounds` sits ~0.6 m inside on every axis. This was only ever about what you can see.
- **2026-08-23** — The shell's first pass was near-black with faint lines, on the theory that a backdrop should recede. It receded so far it was indistinguishable from the void it covered — the gap still read as a hole, just a hole with two lines in it. A backdrop has to be visibly *something*; the tone went up until it read as a wall.
- **2026-08-23** — `position: fixed` **resolves against the nearest transformed ancestor, not the viewport** — and `/explore` centres its canvas with `left-1/2 -translate-x-1/2`. Going fullscreen there silently produced an absolutely-positioned box inside a 94vw column rather than a full-screen canvas. The wrapper's transform is dropped while immersive. Verified rather than assumed: the fullscreen element measures 1280x820 at 0,0 on both routes.
- **2026-08-23** — Meshopt compression, **not Draco**. `useGLTF`'s `useDraco` defaults to *true* and points a DRACOLoader at `https://www.gstatic.com/draco/...` — a third-party CDN fetch on the render path of a site whose entire architecture is "nothing on the render path can break". `useGLTF(url, false)` turns it off; drei bundles the meshopt decoder locally, so nothing is fetched from any origin but ours.
- **2026-08-23** — Optimised output is **committed to the repo**, not built during the Vercel deploy. Building assets at deploy time would make every deploy depend on a toolchain unrelated to Next.js, and would make a broken pipeline look like a broken site.
- **2026-08-23** — ~~The craft got a nose cone it did not have in the mesh~~ — **moot once the VT-802 took over as the craft.** The cone existed because a ducted quad is four-way symmetric at flying distance and heading otherwise reads as broken controls. The VT-802's silhouette carries its own heading, so the cone is gone. Keep the reasoning: any radially symmetric craft put under the visitor's hands will need the cue back.
- **2026-08-23** — **The rotors do not turn**, and that is a limitation rather than a choice. The pipeline merges each source into a single mesh, so there is nothing to attach a rotation to. Overlaying fake discs on modelled props looks worse than stillness. The fix is upstream: export rotors as their own nodes, set `keepNamed: true` on the `join` step, then find and turn them by name.
- **2026-08-23** — The procedural drone is **kept as the Suspense fallback**, not deleted. It costs a few KB and it is what flies while the GLB is in flight — or for good, if that fetch never lands. A flight sim with no aircraft is a worse failure than a plain one.
- **2026-08-22** — The scouts' patrol routes were **rewritten to overlap**. The first version kept each scout strictly in its own half, which told the "fusion buys coverage" story but left nothing mapped twice — so there was no doubled wall to see and the unaligned view just looked like two tidy halves. Both now cross the doorway twice a lap.
- **2026-08-22** — The fused view is built from **known-true poses, standing in for a solved alignment**. Not a browser reimplementation of scan matching, and the page says so in as many words rather than letting the visualisation imply more than it does.
- **2026-08-22** — Wheel slip is kept, not fixed. Driving a scout into a wall stops the robot while its odometry keeps counting, tearing the map within seconds. It reads as a bug for about two seconds and then as the best interactive explanation of drift on the page, so it is documented and invited rather than clamped away.
- **2026-08-22** — The drone game lives at **`/explore`, not on `/`**. The homepage stays text-first, ATS-scrapeable and free of three.js; the invitation is one button. A recruiter on a slow phone must never meet a loading canvas where the CV should be.
- **2026-08-22** — Explore zones are **derived from the same MDX frontmatter the project pages read**, and the same `zones` array renders both the 3D world and the full static list beneath it. The world cannot say something the site does not, and a visitor with WebGL off gets every word.
- **2026-08-22** — The jump list uses per-project **labels, not domains**. Three projects share the domain "Robotics", so a list built from `zone.short` had three identical buttons — found by a test that could not tell them apart either.
- **2026-08-22** — Zone panels are positioned by a **custom `calculatePosition` that clamps them inside the canvas**. drei's default projects the anchor and leaves it there, which put the top of every panel off-frame at exactly the moment you arrived to read it. Clamping also makes an off-screen marker's panel slide along the edge, pointing back at what it belongs to.
- **2026-08-22** — `/explore` breaks out of the page's `max-w-3xl` column to `min(94vw, 1700px)` and 80vh. 94vw, not 100vw: a full-viewport-width child inside a centred column overflows by exactly the scrollbar's width and gives the whole page a horizontal scrollbar.
- **2026-08-22** — Control surface follows `(pointer: coarse)`: thumb sticks on touch, a keyboard legend in the bottom-right corner on a mouse. Showing both put two large stick pads on a desktop screen that nobody was going to drag.
- **2026-08-22** — The "Everything in the world" text is **collapsed into a `<details>`, not removed**. It was crowding a world that now fills most of the screen, but deleting it would take the no-WebGL path and the indexable text with it. Closed by default, every word still in the server HTML — verified by curling the route and grepping.
- **2026-08-22** — Touch controls are laid out **Mode 2** — throttle and yaw left, pitch and roll right — because that is how a real transmitter is arranged and it cost nothing to get right.
- **2026-08-22** — Seeded randomness moved to `src/lib/random.ts`, shared by the SLAM drift and the explore skyline. Both need stable-but-scattered, and `Math.random` in a render path is a hydration mismatch waiting to happen.
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
- [ ] Which domain name? (blocks Phase 6. No longer blocks notification: that went to Discord on 2026-09-04 precisely to stop waiting on it. Settling the domain makes the email path viable again if `reply_to` turns out to be missed — see the runbook's §3d)
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
| 2026-08-22 | `/lab/ascilam`, uncompressed JS | 1,395 KB (three.js, isolated to this route) |
| 2026-08-22 | `/explore`, uncompressed JS | 1,390 KB (three.js, isolated to this route) |
| 2026-08-22 | SLAM arena, 45 s autonomous run | fused coverage 74.8%; α drift 1.76 m / 6.5°, β 0.99 m / −1.9° |
| 2026-08-22 | Content routes after both additions | 462–475 KB, still no three.js |
| 2026-08-23 | `quadcopter.glb` raw → built, `schematic` profile | 16,881 KB → **24 KB** (99.9%), 501,338 → 4,956 triangles |
| 2026-08-23 | `vt-802.glb` raw → built, `pbr` profile | 25,144 KB → **410 KB** (98.4%), 43,384 → 18,146 triangles; textures 21,909 KB → 93 KB |
| 2026-08-23 | `city.glb` raw → built, `pbr` profile | 260 KB → **27 KB** (89.6%), 2,616 triangles unchanged, 1 draw call |
| 2026-08-23 | `/explore` after all three models | 1,467 KB JS (**+77 KB**: GLTFLoader, meshopt decoder, PMREM/RoomEnvironment) + **460 KB** of asset |
| 2026-08-23 | `lab.glb` raw → built, `interior` profile | 59,397 KB → **2,690 KB** (95.5%), 179,429 → 91,213 triangles; 110 maps 49,090 KB → 1,371 KB at 512 |
| 2026-08-23 | KTX2 measured against WebP on the lab | WebP 2.53 MB wire / ~95 MB VRAM · KTX2 (UASTC+ETC1S) 5.92 MB wire / ~12 MB VRAM — WebP kept |
| 2026-08-23 | `/explore/lab` | 1,465 KB JS + 3,100 KB models = 4.57 MB, inside the 5 MB payload budget with little room |
| 2026-08-24 | Phase 8.2 `ConsoleCard`, per-route JS delta (same harness, before/after) | +1 KB on every route — the shared chunk |
| 2026-08-24 | **Per-route JS after 8.2, corrected harness** | `/` **478** · `/about` 462 · `/projects` 462 · `/contact` 462 · `/lab` **1,402** · `/lab/ascilam` **1,395** · `/lab/sobel` 476 KB |
| 2026-08-24 | Phase 8.9 guided sequence | **0 KB JS** — every route identical to baseline; `/` 462 KB, `/lab` 1,402 KB |
| 2026-08-24 | 8.9, before the prefetch fix | `/` **515 KB** — stacked chapters put every link permanently in-viewport |
| 2026-08-24 | 8.9 sequence shape | 5.9 screens; exactly one chapter legible at any scroll (worst overlap 0.12) |
| 2026-08-24 | Phase 8.6 portal — `/` at rest | **462 KB**, down from 478 KB. The hero link was prefetching `/explore`'s route chunk on every load |
| 2026-08-24 | Phase 8.6 portal — `/` after scrolling to the door | 478 KB (the 16 KB `/explore` entry, prefetched exactly when it is wanted) |
| 2026-08-24 | Portal poster | 1200 px WebP **12,510 B** · 700 px WebP **5,346 B** |
| 2026-08-24 | Phase 8.5 particle field, **canvas version** (rejected) | +2 KB on *every* route incl. `/lab`; via `next/dynamic` +5 KB |
| 2026-08-24 | Phase 8.5 particle field, **CSS version** (shipped) | **0 KB JS on every route**; `/lab` 1,402 KB reproduced; CSS 42,266 → 43,076 B (+810) |
| 2026-08-24 | Phase 8.4 scroll disclosure | **0 KB JS on every route** (identical before/after); CSS 40,610 → 42,266 B (+1,656) |
| 2026-08-24 | Portrait assets | 256 px WebP **8,496 B** · 512 px WebP **21,206 B** · OG JPEG 280 px **16,696 B** — crop `left:150 top:120 580×580` of the 865×870 source |
| 2026-08-24 | `/` model requests, fresh context, models present | **none** — the homepage pulls no GLB, confirmed after a harness error suggested otherwise |
| 2026-08-24 | Phase 8.1 tokens, emitted CSS | 40,460 → 40,610 bytes (**+150**), no utility changed shape, JS untouched |
| 2026-08-23 | Environment candidates rejected on measurement | `a_metaverse_bar` floors at 400k tris / 7.1 MB; `sci_fi_hallway` 402 MB source, over GitHub's 100 MB file limit; `scifi_room_interior` 170–262 KB but an interior |

Measured by loading each route from `next start` in headless Chromium and summing JS
response bodies. The number worth keeping: a real-time CV demo cost 13 KB, because it is
one shader and two triangles rather than a scene graph.

**Harness note, learned the hard way on 2026-08-23.** A first pass read every route ~17%
low and wildly unstable (`/projects` came out at 22 KB once). Two bugs, both worth not
repeating: the response handler `await`ed `response.body()` inside the listener and the
page was closed before those promises settled, so whole chunks vanished silently; and all
routes shared one browser context, so each route was credited only with what the previous
one had not already cached. Collect the body promises and `Promise.all` them before
closing, and give every route a fresh `browser.newContext()`. With both fixed the
unchanged routes reproduce the 2026-08-22 figures exactly — `/lab` 1,402 KB, `/lab/ascilam`
1,395 KB, `/lab/sobel` 475 KB — which is the check that says the harness is honest.
