# 3D Interactive Portfolio - Architecture Assessment

**Date:** 2026-08-21
**Proposed stack:** React + three.js on Vercel · Python backend on AWS EC2 · Supabase (Postgres)
**Stated constraints:** free tier only · global recruiter audience · backend needed for ML/CV demos and a 3D asset pipeline
**Build plan and current phase:** [`PLAN.md`](./PLAN.md) · **Visual rules:** [`DESIGN-LANGUAGE.md`](./DESIGN-LANGUAGE.md)

---

## 1. Verdict up front

The frontend half of the plan is right. The backend half is the problem: **an always-on EC2 instance is no longer compatible with "free tier only," and a free-tier-sized instance cannot run the ML/CV demos you want it for.** Those two facts are independent, and each one alone kills the design.

The fix is not a cheaper server. It's recognising that both of your stated backend jobs - ML/CV inference and 3D asset processing - have better homes than a long-running VM:

- 3D asset processing is a **build-time** job, not a runtime service.
- ML/CV inference for a portfolio is best run **in the visitor's browser**, which is free, infinitely scalable, has no cold start, and is a stronger demonstration of skill than a REST endpoint.

Everything below is the reasoning and the replacement design.

---

## 2. Constraint analysis

### 2.1 AWS free tier no longer works the way you're assuming - **blocking**

AWS restructured the free tier. New accounts no longer get 750 hours/month of t2.micro/t3.micro for 12 months. Instead:

- New accounts get **$100 in promotional credits**, expiring 12 months from signup.
- A **Free Plan** account expires at **6 months or credit exhaustion, whichever comes first**; you then have 90 days to upgrade to a Paid Plan or the account is closed.
- Some services now require a Paid Plan account outright.

Real cost of a modest always-on box in `ap-south-1`/`us-east-1` terms:

| Item | ~Monthly |
|---|---|
| t3.micro on-demand, 730h | ~$7.50 |
| 20 GB gp3 EBS | ~$1.60 |
| Public IPv4 address (now billed hourly) | ~$3.60 |
| **Total** | **~$12–13/mo** |

$100 of credits buys roughly **8 months** of an idle instance - then the site starts billing you, or dies. For a portfolio that should quietly outlive your degree, that's a liability, not infrastructure.

> Note: the *always-free* tier still exists for some services (Lambda's monthly free requests/compute, DynamoDB, CloudFront's free allowance), but **not** for EC2 compute.

### 2.2 A free-tier-sized instance cannot serve ML/CV - **blocking**

t3.micro is 2 vCPU **burstable** with **1 GB RAM**. For context:

- A CPU-only PyTorch install is ~800 MB–2 GB on disk before your model.
- Loading almost any vision model plus an inference request pushes past 1 GB resident; you'll OOM or thrash swap.
- Burstable CPU credits deplete under sustained inference, and the instance throttles to a baseline of ~10–20% of a vCPU - exactly when a recruiter is watching.

An instance that could actually serve CV demos (t3.small/medium, 2–4 GB) is $17–35/mo. You said free tier only. These are incompatible.

### 2.3 Supabase pauses free projects - **high risk, quietly fatal**

Supabase Free: 500 MB DB per project, 1 GB storage, 5 GB egress, 2 active projects - and **projects may be paused after about one week of low activity.**

Think about the traffic shape of a portfolio: nothing for two weeks, then a recruiter opens it. That is precisely the pattern that gets your database paused. If the page renders its project list *from* Supabase, the recruiter sees a spinner or an error. **The one visitor who matters gets the broken version.**

### 2.4 Vercel Hobby is non-commercial - **watch it**

Hobby gives 100 GB/month fast data transfer and 1M function invocations - generous for your traffic. But Hobby is **personal, non-commercial use only.** A personal portfolio is fine. Adding freelance rate cards, a "hire my agency" pitch, client work sold through the site, or ads moves you into Pro ($20/mo) territory. Keep the framing personal.

### 2.5 Asset weight vs. a global audience - **the real UX constraint**

Your audience is global recruiters, many on mid-range phones and hotel Wi-Fi. This, not compute, is what actually determines whether the site impresses anyone.

- An unoptimised GLB scene is easily 20–50 MB. That's 30+ seconds on a 4G connection, and recruiters leave.
- Target: **< 2 MB critical path, < 5 MB total initial 3D payload**, everything else lazy-loaded.
- Draco or Meshopt geometry compression plus KTX2/Basis textures typically gets 60–90% off. This is non-negotiable, and it's a build-step, not a server.

### 2.6 Operational surface for zero visible benefit

Three platforms means three deploy pipelines, three dashboards, CORS between Vercel and EC2, a domain and TLS cert on the instance (nginx/Caddy + Let's Encrypt renewal), security groups, and OS patching on a box that's exposed to the internet. It's a lot of maintenance for a site whose job is to load fast and look good - and every one of those is a way for the site to be broken on the day it matters.

### 2.7 Latency and SEO

- A single-region EC2 gives 200–300 ms RTT to half the planet. Fine for a contact form; unacceptable if the 3D scene blocks on it.
- A pure client-rendered WebGL SPA is close to invisible to search engines and to any ATS that scrapes your link. Your text content - bio, project write-ups - must exist as **real HTML in the initial response**.

---

## 3. Recommended architecture

**Principle: the page a recruiter sees must never depend on a server that can be asleep, out of credits, or unpatched.**

Split the system into a static core that cannot fail, and optional live demos that degrade gracefully.

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (static + edge)                                 │
│  React + react-three-fiber, SSG/ISR                     │
│  Content as MDX/JSON in repo → real HTML at build       │
│  Compressed .glb / .ktx2 served from Vercel CDN         │
│  ONNX Runtime Web / transformers.js → in-browser CV     │
└───────────────┬───────────────────────┬─────────────────┘
                │ (optional, non-blocking)                │
                ▼                       ▼
     ┌────────────────────┐   ┌──────────────────────────┐
     │ Supabase (free)    │   │ HF Space / scale-to-zero │
     │ contact form,      │   │ heavy demo only, cold-   │
     │ view counts, RLS   │   │ start tolerated, opt-in  │
     └────────────────────┘   └──────────────────────────┘

     Build-time only (no server):
     GitHub Actions → gltf-transform / gltfpack → optimised assets
```

### 3.1 Frontend - keep, but static-first

React + **react-three-fiber** + **drei** on Vercel. R3F over raw three.js: you get declarative scenes, `<Suspense>`-based asset loading, and drei's `useGLTF`/`Environment`/`Html` helpers, which removes most of the imperative boilerplate.

- Next.js (App Router) or Vite + a prerender step. Either way, **all portfolio content is in the repo** - MDX or JSON - and rendered at build time. Zero runtime database dependency for anything a visitor reads.
- Ship a **non-WebGL fallback**: detect WebGL support and honour `prefers-reduced-motion`; serve a clean 2D layout otherwise. Some corporate laptops and locked-down browsers will thank you, and so will your Lighthouse score.
- Never let the 3D scene gate the text. Content first, canvas hydrates over it.

### 3.2 3D asset pipeline - move it to build time, delete the server

This is the change that removes your biggest justification for EC2. Mesh decimation, GLTF optimisation, texture compression, and procedural geometry baking are all deterministic transformations of files you control. They do not need to happen while a visitor waits.

- `gltf-transform optimize` or `gltfpack` (meshoptimizer), plus `toktx`/`basisu` for KTX2 textures.
- Run it in a **GitHub Action** on push, or locally, and commit/emit the optimised artifacts.
- If you want a heavier authoring step (Blender headless, procedural generation), that's still a GitHub Actions job - 2,000 free minutes/month on private repos, unlimited on public ones.

You get reproducibility, versioned assets, no runtime cost, and no cold start. The "pipeline" is still a genuine portfolio artifact - it's just a CI workflow instead of a VM.

### 3.3 ML/CV demos - run them in the browser

For an interactive portfolio, **client-side inference beats a hosted API on every axis that matters here**: no server cost, no cold start, no rate limiting, no CORS, works offline, and it scales to any number of simultaneous recruiters for $0.

- **ONNX Runtime Web** (WASM + WebGPU backends) - export your PyTorch model to ONNX, quantise to int8, run it in a worker.
- **transformers.js** if your demo maps onto a Hugging Face model.
- **TensorFlow.js** for the classic webcam demos (pose, hand tracking, segmentation).
- Keep models under ~10–25 MB quantised, and **lazy-load on user click**, never on page load.

This also plays directly to your graphics and CV interests: a live webcam segmentation or edge-detection demo running in WebGPU next to a three.js scene reads as considerably more sophisticated than "I have a Flask endpoint."

For a Sobel/edge-detection style demo specifically, a WebGL fragment shader or WebGPU compute shader does it in real time at 60 fps - no model, no server, and it's thematically perfect next to a 3D scene.

### 3.4 When the browser genuinely can't - scale-to-zero, not always-on

Some things are legitimately too heavy for a client: a large diffusion model, a multi-GB point-cloud pipeline. For those, use something that costs nothing while idle:

| Option | Why it fits | Catch |
|---|---|---|
| **Hugging Face Spaces** (free CPU) | FastAPI/Gradio in Python, free, and the Space is itself a portfolio surface recruiters can browse | Sleeps when idle; cold start ~30s |
| **Modal** | Real Python, scale-to-zero, monthly free compute allowance, GPU available | Cold starts; needs an account |
| **Google Cloud Run** | Container, scale-to-zero, generous always-free request tier | Cold start; GCP account |
| **Fly.io** | Auto-stop machines, cheap | Small monthly cost once idle time adds up |

Design the UI for it: a "Run demo" button, an honest "warming up the model, ~30s" state, and a precomputed sample result shown immediately so the page is never empty. **Nothing on the page should block on this.**

### 3.5 Supabase - keep, but demote it

Keep it for what it's genuinely good at, and never on the critical render path:

- Contact form submissions, view counters, demo-usage analytics, a guestbook. All **write-mostly, read-rarely, non-blocking**.
- **Enable RLS on every table from day one.** The anon key ships to the browser; it is public by definition. Insert-only policies for the contact table, no select for anon.
- Mitigate the pause: a GitHub Actions cron every 2–3 days issuing a trivial query keeps the project warm. Cheap insurance - but still write the frontend so a paused DB degrades to "contact me by email" rather than an error.
- Supabase Storage is an option for large downloadable assets (your CV, a demo video), but for 3D assets on the critical path, Vercel's CDN is faster and simpler.

### 3.6 Keeping AWS in the story without paying rent

If part of the point is demonstrating that you can deploy a backend - a fair goal, and one recruiters do look for - you don't have to keep it running to prove it:

- Publish a repo with a **Dockerfile, Terraform/CDK for the VPC + EC2/ECS + ALB, and a GitHub Actions deploy workflow**. The code and the IaC are the evidence; a running instance adds nothing a screenshot doesn't.
- Add an architecture diagram and a short write-up to the portfolio page itself.
- Spin the stack up **only when you're in an interview loop**, then tear it down. Your $100 of credits goes much further as a few weeks of live demo than as eight months of idle.

---

## 4. Revised stack summary

| Layer | Original plan | Recommended | Why |
|---|---|---|---|
| Hosting | Vercel | **Vercel** ✅ | Right choice; global CDN, free for personal use |
| UI | React + three.js | **React + react-three-fiber + drei** | Same engine, far less boilerplate |
| Content | Supabase-driven | **MDX/JSON in repo, SSG** | Can't break, SEO-visible, no DB on render path |
| 3D assets | Processed on EC2 | **Build-time gltf-transform/gltfpack in CI** | Not a runtime concern; free; reproducible |
| ML/CV demos | Python API on EC2 | **ONNX Runtime Web / TF.js / WebGPU in-browser** | Free, no cold start, scales, more impressive |
| Heavy inference | Python API on EC2 | **HF Space or Modal (scale-to-zero)** | $0 idle; opt-in with honest loading state |
| Light API | Python API on EC2 | **Vercel Functions or Supabase Edge Functions** | Contact form / counters need ~20 lines |
| Database | Supabase | **Supabase** ✅, non-critical paths only, RLS on | Fine, but never block a render on it |
| Always-on EC2 | Yes | **No** | Not free after credits; too small to be useful |

**Net monthly cost: $0**, plus ~$10–15/year if you want a custom domain - which you should. `suhan.dev` on your CV beats `suhan-portfolio.vercel.app`.

---

## 5. Suggested build order

1. **Content and structure first.** Bio, 3–5 project write-ups as MDX, a real CV PDF. Ship a plain, fast, non-3D version to Vercel. This alone is a working portfolio, and it's what most recruiters read.
2. **Add the 3D layer** progressively over that content. One well-executed hero scene beats five janky ones. Lock a performance budget: < 2 MB critical path, 60 fps on a mid-range phone, and a 2D fallback.
3. **Wire the asset pipeline** into GitHub Actions once you have more than a couple of models.
4. **One in-browser demo.** Given your background, a WebGPU/WebGL edge-detection or segmentation demo running on webcam input is a strong, low-risk first choice.
5. **Supabase last**, for the contact form. RLS on, keep-warm cron, graceful failure.
6. **Optional:** the IaC repo and a temporary AWS deployment, timed to when you're actively interviewing.

## 6. Things to get right early

- **Performance budget in CI.** Lighthouse CI or a bundle-size check on every PR. 3D portfolios rot into 40 MB monsters without one.
- **Accessibility.** Keyboard navigation, `prefers-reduced-motion`, real text (not text baked into a canvas). Some recruiters use screen readers; all of them use Ctrl-F.
- **Mobile first.** A meaningful share of first views will be on a phone. Test on a real mid-range Android, not just a desktop with the devtools throttle on.
- **Don't let the 3D bury the content.** The most common failure of 3D portfolios is that they're beautiful and you can't find out what the person actually did.

---

## Sources

- [AWS Free Tier Terms](https://aws.amazon.com/free/terms)
- [Supabase Free Plan limits (CostBench, verified Jul 2026)](https://costbench.com/software/database-as-service/supabase/free-plan/)
- [Vercel Pricing](https://vercel.com/pricing)
