# 3D Portfolio — Build Plan & Progress

**Owner:** Suhan · **Repo:** `D:\Projects\Portfolio`
**Architecture rationale:** see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
**Started:** 2026-08-21 · **Last updated:** 2026-08-23

> **How to use this file.** Each phase is independently completable and ends in something deployed and working. Tick boxes as you go, update the status table, and append to the Decision Log whenever you make a call that a future session would otherwise have to re-litigate. To resume after a break, read §1 and §2, then jump to the first phase not marked ✅.

---

## 1. Status at a glance

| # | Phase | Outcome when done | Status |
|---|---|---|---|
| 0 | Foundations | Repo + Vercel deploy pipeline live | ✅ Done |
| 1 | Content core | Readable, fast, non-3D portfolio online | 🟡 In progress |
| 2 | 3D layer | Three interactive scenes + the explorable world | 🟡 Built, needs device test |
| 3 | Asset pipeline | Optimised GLB built in CI | ✅ Done |
| 4 | In-browser demo | One live CV/graphics demo, client-side | 🟡 Built, needs device test |
| 5 | Supabase | Contact form, RLS, degrades gracefully | 🟡 Code done, needs your accounts |
| 6 | Polish & launch | Domain, a11y, perf gates, SEO | ⬜ Not started |
| 7 | *Optional* — AWS artifact | IaC repo + write-up, spun up on demand | ⬜ Not started |

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
- [ ] **Measure on a real mid-range Android**, not a throttled desktop — now covering
      `/lab`, `/lab/ascilam` and `/explore`. The explore world is the heaviest of the three
      and the one most likely to disappoint on a phone
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
      hard limit.** The no-LFS call still stands but it is no longer comfortable: one more
      asset this size and it needs revisiting. `models/environments/` is gitignored and
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
