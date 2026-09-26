# Design Language - reference study and adoption plan

Studied 2026-08-24. Three award-level sites, read for **what they do**, then filtered through this
project's hard constraints (static-first, $0/mo, <2 MB critical path, content routes 462–475 KB with
no three.js, `prefers-reduced-motion` respected, every scene needs a WebGL-absent fallback).

Read this before touching `globals.css`, `Nav.tsx`, `Footer.tsx`, `ProjectCard.tsx`, or adding any
motion/audio to a content route. Scene-level rules stay in `lab_scenes` / `lab_room_scene` memory.

---

## 1. What the references actually do

### Igloo Inc - <https://www.igloo.inc/> (animation + transitions)

Stack the team published: **Three.js + three-mesh-bvh, Svelte, Vite, GSAP**, assets from Houdini and
Blender, sound from Bureaux, sound edit in DaVinci Resolve.

The parts worth stealing are principles, not code:

| What they do | Why it works |
|---|---|
| **One continuous camera path.** Scroll does not swap pages, it drifts a camera between three frozen landscapes. | The site has no "transitions" as such - there is one space, and scroll is a position in it. Nothing has to match on either side of a cut because there is no cut. |
| **A signature dissolve, reused everywhere.** Chromatic aberration + displacement + a frost effect, on every scene change. | One transition, applied consistently, reads as a material. Three different transitions read as a demo reel. |
| **UI drawn in WebGL, not DOM.** Text glitch is a shader; letter-scramble swaps SDF texture offsets rather than forcing a relayout every frame. | The effect budget is spent on the GPU, so the effect can be per-frame without touching layout. |
| **Procedural, not modelled, hero assets.** Ice blocks grow by a crystal-growth algorithm inside a container shape, so a new project is a new container, not a new model. | Content scales without art labour. Directly analogous to our zones being built from MDX frontmatter. |
| **Custom exporters over generic formats.** A VDB→browser exporter compresses the footer's particle volume smaller than a typical website image. | Payload discipline is an art-direction decision, not a post-hoc optimisation. |
| **Intro animation exists to set genre.** They deliberately added "tech vibes" so the site did not read as merely outdoorsy. | The first 2 seconds declare what kind of thing this is. |
| Audio was **synchronised to particle movement**, reinforcing motion rather than playing alongside it. | See §4. |

**Not transferable:** shader-driven text (kills our SEO, our MDX pipeline, and our accessibility
story), and GSAP-orchestrated everything (dependency weight on routes budgeted at ~465 KB).
**Transferable:** the *single continuous space*, the *one signature dissolve*, and *procedural
content-driven assets* - all three of which we already half-do in `/explore`.

### IRIS K - <https://theirisk.com/welcome> (sound + particles)

- Dark to near-black ground (`#020208`), one loading screen image, logotype-led.
- A **held gate**: "Press Any Button" → "Break the Silence". Audio never starts on its own; the
  visitor performs a deliberate act to unmute, and the copy makes that act part of the story.
- Explicit **"headphones recommended"** line before the experience.
- A persistent **Mute** control, always visible, never buried in a menu.
- Navigation is **Back / Next / Home / End** - transport controls, not a nav bar. The site is
  presented as a "music museum" and the chrome commits to that metaphor.
- Real audio files, not loops-as-decoration: a named master track drives the page.

The lesson is **audio etiquette as design**: consent gate → named control → metaphor-consistent
chrome. Nothing here requires WebGL.

### Chrome Tattoo Paris - <https://chrometattooparis.com/profile> (profile card + cyber style)

- The page is dressed as a **control panel**: a mock system header, `CONTROL PANEL ID / MINISTRY OF
  INFORMATION v5.09`, a version number, driver declarations.
- The profile is a **card of labelled fields**, not a paragraph: operator name, age, personality,
  origin (`Cyber_Terran`), localisation, favourite meal, hobby. Personality is delivered *through the
  schema*, not through prose.
- Dark monochrome + terminal-green, fixed-width type throughout.
- Deliberate **noise**: junk alphanumerics (`908765TYGHJKHGFVB`), corrupted file references - texture
  that costs nothing and sells the fiction.

This is the cheapest of the three to adopt and the closest to what we already have: our accent
`#3ddba0` on `#0b0d10` *is* terminal-green on black, and `--font-mono` is already a token.

---

## 2. The through-line

All three sites are coherent because **one metaphor governs every surface**. Igloo = a frozen
landscape you fly through. IRIS K = a music museum you are admitted to. Chrome = a terminal you are
logged into.

Our metaphor is already latent and half-built: **an instrument schematic / flight console**. Unlit
wireframes, `#3ddba0` on near-black, hotspot callouts, telemetry. `/explore` and `/lab` speak it
fluently; the content routes (`/`, `/about`, `/projects`, `/contact`) currently do not speak it at
all. **That gap is the disorganisation.** The fix is not more effects - it is making the flat pages
obviously the *documentation* of the same machine the 3D routes let you fly.

Rule going forward: *every new surface must be explainable as part of the console.* If it cannot be,
it does not ship.

---

## 3. Screen transitions and scroll

### 3.1 The budget reality

Content routes must stay at ~465 KB with no three.js. That rules out the GSAP + Lenis + Three stack
the reference sites use. It does **not** rule out the effect, because the platform now ships most of
it for free:

| Technique | Cost | Use for |
|---|---|---|
| **View Transitions API**, driven by hand | ~2 KB on every route | Route cross-fade and the card → case-study title morph. Corrected twice: on 2026-08-24 it was found *not* free - `react@19.2.8` stable has no `ViewTransition`, and CSS `@view-transition` only fires on cross-document navigation, which the App Router never does. Built 2026-09-23 as a client `TransitionLink` that wraps `router.push` in `document.startViewTransition` itself (PLAN 8.3). Not 0 KB; measured at +2 KB. |
| **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) | 0 KB | Section reveals, parallax, progress rails, sticky-scrub sequences. Runs off the main thread. |
| **`IntersectionObserver`** | 0 KB | One-shot state (audio ducking, pausing a canvas). **Not** used as a reveal fallback - see below. |
| **`position: sticky` + a scrubbed child** | 0 KB | The "camera drifts while you scroll" feel, in 2D. A sticky visual, scrubbed by a scroll timeline over a tall spacer. |
| GSAP / Lenis | ~70–90 KB | Only inside `/explore` and `/lab`, where the budget already accepts three.js. Never on a content route. |

### 3.2 Rules

0. **A reveal is an enhancement, and enhancements may be absent.** A browser without
   `animation-timeline` shows the content with no animation. That is the fallback. Do not put
   a client component on a content route so a decoration can work everywhere.
1. **One transition vocabulary, defined once.** A single signature reused site-wide, built from
   tokens in `globals.css` (`--t-fast: 180ms`, `--t-page: 420ms`, `--ease-console:
   cubic-bezier(.16,1,.3,1)`); never hand-roll a duration in a component.

   *Corrected in 8.8.* The easing is `--ease-console`, not `--ease-out`: `--ease-*` is a Tailwind v4
   `@theme` namespace, and `--ease-out` would have silently redefined every existing `ease-out`
   utility. And the shipped signature is not the mask-wipe with a chromatic offset proposed here -
   it is a **sequential handoff**: the old page clears over `--t-fast`, the new one rises 6 px and
   settles over `--t-page`. The same call the home chapters made (PLAN Decision Log 2026-08-24): two
   pages legible at once read as a fault. The wipe was never prototyped; revisit only if the
   handoff reads as too plain on real hardware.
2. **Transitions carry meaning or they are noise.** Moving *deeper* (index → project) uses the
   forward form; moving back uses its exact inverse. A cross-fade for both is a wasted signal.

   *Not met - recorded rather than hidden (8.8).* One form serves both directions today. Direction
   is carried by the shared element instead: going deeper, the clicked title grows into the page's
   heading; going back via `← Projects` it does not return to a card. The browser **Back button does
   not animate at all** - a `popstate` navigation never passes through `TransitionLink`. Both are
   the open items if this is revisited.
3. **Never move the reader's content under them.** Scrub decoration - rails, backgrounds, the
   schematic - never the paragraph being read. Igloo can scrub everything because it has no long-form
   text; we have MDX case studies.
4. **Scroll must remain native.** No hijack, no smooth-scroll library on content routes. A
   scroll-jacked page is unusable on a trackpad and on assistive tech.
5. **First paint is content.** No preloader on a content route. `/explore` and `/lab` keep their
   loaders because they genuinely have something to load; a preloader in front of an MDX page is a
   lie about the payload.
   *Exception (2026-09-26, Decision Log):* a ~1.4 s logo splash on the first load of a tab session,
   JavaScript-only and skipped for crawlers. Slow navigations show a logo loader only after 500 ms.
6. **Reduced motion is a real branch, not a speed setting.** Under `prefers-reduced-motion`,
   transitions become instant state changes and scrubbed sequences render at their end state - do not
   just shorten durations to 0.01 ms and call it handled (the current blanket rule in `globals.css`
   is a floor, not the design).
7. **`/` stays a doorway** - see §6.5 for the one qualified exception (a gated portal, canvas
   lazy-mounted on explicit activation only). No canvas is ever in the homepage's initial graph.
   The intro animation, if we build one, is a CSS/SVG schematic assembling itself - sub-20 KB,
   skippable, shown once per session (`sessionStorage`), and never blocking the link.

### 3.3 The shared-element move worth building first

`ProjectCard` → `/projects/[slug]`: the card's title becomes the page's `<h1>`. Degrades to a plain
navigation where unsupported or under reduced motion. Built 2026-09-23 (PLAN 8.3).

*Corrected in 8.8 - the name must NOT be stable.* A fixed `view-transition-name` on every card title
makes every card on the page a participant: navigating `/` → `/projects` sends the home page's three
cards - including ones in faded, invisible chapters, because a snapshot ignores its ancestors'
opacity - flying across the screen into the index. The name is set on the **one clicked element**
(`data-vt-morph`) and on the landing heading (`data-vt-land`) for the duration of the transition
only. There is no thumbnail: cards do not have one. And it does not work with the back button (rule
2 above).

---

## 4. Background music

Copy IRIS K's **etiquette**, not its volume.

1. **Never autoplay.** Browsers block it anyway, and a portfolio that makes noise unasked gets closed.
   Ship muted; audio starts only on a deliberate gesture.
2. **Gate it with copy that belongs to the metaphor.** IRIS K's "Break the Silence" works because it
   is museum language. Ours should be console language - e.g. an `AUDIO ▸ ARMED / MUTED` toggle in
   the console chrome. One control, always visible, keyboard-reachable, `aria-pressed`.

   A volume slider appears beside it **while armed only**, added 2026-09-04. "One control" is a rule
   about the *gate*, not a budget for the whole feature: a volume control on a muted site adjusts
   nothing, and showing it before the question is answered would put two things in the corner
   reserved for the one that matters. Volume defaults to half the measured ceiling in §4.6, persists
   separately from the armed/muted choice, and is a native range input so the keyboard path is the
   browser's rather than ours.
3. **Scope: `/explore` and `/lab` only.** Content routes stay silent. Music under a case study
   competes with reading.
4. **Persist the choice** in `localStorage` and honour it across routes, so it is answered once.
5. **Sound reinforces motion.** Igloo's audio is tied to particle movement. Our analogue: subtle
   engine/telemetry response tied to craft speed in `/explore`, a soft tick on hotspot focus in
   `/lab` - not a music bed playing regardless of what the visitor is doing.

   There **is** now an ambient bed under that, added 2026-09-04, and it does not contradict the
   rule. "Regardless of what the visitor is doing" is about a track that starts because a page
   loaded; this one exists only for someone who explicitly armed it, and the engine over it is
   still the part that reacts. Reactive-only was tried first and read as broken: with nothing
   playing while hovering, an armed toggle and silence are indistinguishable from a bug.
6. **Implementation, budget-safe:** Web Audio API directly (0 KB of library). One `AudioContext`,
   created inside the unmute gesture handler (never before - it will be suspended). A single
   `GainNode` master with a 300–600 ms ramp for fades (never a hard cut). Ducking and pausing on
   `visibilitychange` are required, not polish.

   **Built 2026-09-03 with no audio file at all.** The original text here specified a ~60–90 s
   seamless loop at 96–128 kbps mono (≈0.7–1.4 MB), lazily loaded. Every voice is synthesised
   instead - two detuned saws through a speed-driven lowpass plus filtered noise, and a 140 ms sine
   for the tick. Synthesis collapses three of this section's rules into a non-problem: nothing is
   fetched, so rule 6's payload arithmetic has nothing to constrain; rule 8's licence gate is met by
   having nothing to license; and rule 5 is satisfied by construction rather than by effort, because
   the sound is computed *from* craft speed rather than mixed against it. A file was the assumption,
   not the requirement.

   **Synthesis has its own trap, and it is not payload - it is the speaker.** A sine partial has no
   harmonics, so its fundamental is the entire signal; a laptop speaker reproduces almost nothing
   below ~200 Hz. The first build put the ambient bed on A2/E3/A3 and the engine on a 46 Hz
   fundamental behind a 170 Hz lowpass, and measured **-54.6 dBFS above 200 Hz** while hovering -
   inaudible on the hardware most visitors have, at any volume. Measure the band the speaker can
   actually produce, not the overall RMS: here the two differ by 20 dB, and only one of them
   predicts whether anyone hears it. Current levels, tapped from the shipped graph: pad -23.8,
   engine idle -21.8, cruise -20.1, full speed -15.9 dBFS above 200 Hz, with a limiter on the
   master so the three voices cannot sum past clipping.
7. **`prefers-reduced-motion` does not imply silence**, but if we ever add reactive visuals driven by
   audio, those follow the motion preference.
8. **Licensing is a hard gate.** Only CC0 / CC-BY-with-attribution or purchased-licence audio, with
   the licence recorded next to the file in the repo. Currently moot - see rule 6. If a file is ever
   added, this gate applies to it unchanged.

---

## 5. Particle animations, matched to page mood

Igloo's particles are volumetric and shader-driven, coloured by velocity, glowing between formations.
We cannot pay for that on a content route, and we should not want to - our metaphor is instruments,
not weather.

### 5.1 Two tiers

**Tier A - content routes (`/`, `/about`, `/projects`, `/contact`).** Self-written, `position: fixed`
behind content, `pointer-events: none`, `aria-hidden`, absent entirely under
`prefers-reduced-motion`. If it cannot be done in one small file with no dependency, it does not
belong on a content route.

*Corrected in 8.8.* The field shipped as **CSS-animated spans with 0 KB of JavaScript**, not Canvas
2D or SVG under 4 KB - which made three of this paragraph's rules moot rather than met: there is no
render loop to pause on `document.hidden` (the browser already throttles CSS animation in a hidden
tab), no "before interactive" to wait for, and no per-viewport count to compute. Counts are fixed
per mood (§5.2), and the field is simply absent below 1200 px, where there is no margin to draw in -
so "≤50 on mobile" became zero.

**Tier B - `/explore`, `/lab`.** three.js `Points` with a custom shader is already affordable there.
Reuse the existing lighting/material language: unlit, additive, accent-tinted, `sizeAttenuation`
on. One buffer geometry, updated in a shader by time uniform - never per-particle JS in the render
loop.

### 5.2 Mood mapping

Mood should be *legible*, not decorative - the particle field is telemetry about what page you are
on.

| Route | Mood | Field | Motion | Colour |
|---|---|---|---|---|
| `/` | Invitation, standby | Sparse drifting dust, 22 marks per rail | Slow upward drift (24–44s) | `--fg-muted` at 75% |
| `/about` | Human, calm | Fewer, larger, softer - 12 per rail, 5–12px radial-gradient motes | Bobs ±26px while breathing scale + opacity, 13–22s | `--fg-muted` at 70% |
| `/projects` | Index, order | 4px ticks on a lattice of 44px SQUARE cells, 4 columns per rail, drawn by `::before`/`::after` | Ticks step down the lattice one cell at a time, `steps(24)`, 18–26s | Ticks `--accent` at 75%; lattice `--fg-muted` at 28% |
| `/projects/[slug]` | Focus | **None.** | - | - |
| `/contact` | Signal, transmission | Thin rising streaks, 22–68px, fading along their own length | Upward 8–16s, ×0.32 while a field has focus (`:has()`, no JS) | `--accent` at 60% |
| `/lab`, `/lab/*` | Instrumented | Existing scene language; no extra field | - | - |
| `/explore` | Flight | Speed-reactive motes in the flight volume | Velocity-coupled streak length | Accent, brightening with speed |

Non-negotiables: **case-study pages get no particles**, contrast of body text is never affected
(measure after, not before), and the field never animates during scroll on mobile.

**Two rails, not a scatter.** Every mood draws into the free margin on each side and nowhere else,
with an equal count per rail. The rail is *derived*, not guessed:

```css
--pf-rail: calc((100vw - 48rem) / 2 - 20px);   /* 48rem = the reading column */
```

Marks are positioned as a fraction of that - left-rail marks from `left`, right-rail marks from
`right`, so the two sides mirror exactly. A **percentage** rail is the trap: 15% of the viewport is
comfortably clear of the text at 1440px and sits on the paragraph at 1000px, because the margin
shrinks as the viewport does while the rail grows into it. The field is enabled at **≥1200px**,
where the margin is 216px; below that there is no rail worth having.

**A grid has no partial cells.** The `/projects` lattice is a whole number of square cells (4 × 44px
= 176px) anchored to the outer edge, with an explicit closing rule at the inner edge - a repeating
gradient draws a line at the *start* of each cell, so without it the last column hangs open. The
viewport is never a whole number of cells tall, so the lattice is masked to dissolve over its last
two rows rather than being sliced. Sizing the cell as a percentage of the rail gives rectangles that
change shape with the window, which is what this replaced.

**Motion has to travel.** `/about` and `/projects` originally animated scale and opacity in place;
measured frame-to-frame they were animating, and to the eye they were static - an in-place fade at
these sizes is below the threshold of noticing. Every mood now moves through space: rise, bob, or
step.

**`--border` is not a usable field colour.** It was the documented colour for `/projects` and it
measured invisible in both themes (~1.1:1 against the ground either way). Ticks are `--accent`;
the lattice keeps the structural job at `--fg-muted` 28%. The general rule: a field colour has to
survive the ground it sits on, and the two neutral tokens that do are `--fg-muted` and `--accent`.

---

## 6. The profile card and console chrome

Adapting Chrome Tattoo's control panel, in our own accent, is the single highest-value organising
move for `/about` and for the `/explore` zone panels.

**Build one `ConsoleCard` primitive** and use it everywhere: `/about`'s operator card, project
metadata blocks, `/explore` zone panels, `/lab` hotspot callouts. Anatomy:

```
┌ FLIGHT CONSOLE ▸ OPERATOR ─────────── v0.1.0 ┐   ← mono, uppercase, tracked, --fg-muted
│  [portrait]   OPERATOR ......... <name>      │   ← label · dotted leader · value
│               ROLE ............. <role>      │
│               BASE ............. <location>  │
│               STACK ............ <3 items>   │
│               STATUS ........... <state>     │   ← plain text, NOT StatusBadge (see below)
└──────────────────────────────────────────────┘
```

Rules:

- **Fields, not prose.** Labelled rows in `--font-mono`, uppercase, letter-spaced; values in
  `--font-sans`. The schema is the personality, exactly as in the reference.
- **Real data only.** Chrome can invent "favourite meal: ramen" because it is a persona. An
  engineering portfolio's credibility is its currency - every field must be true and checkable.
  A dry field beats an invented quirky one.
- ~~**Borders are 1 px `--border`, corners near-square (2 px).** No shadows, no glass, no gradients -
  the schematic language is line weight and spacing.~~ **Overturned 2026-09-24 by decision - see
  §6.1.** The panel is now glass; the *fields* inside it (mono labels, dotted leaders, 1 px rules
  between header and body) still carry the schematic language.
- **Chrome text is decoration and must be `aria-hidden`.** Version strings, corner ticks and any junk
  glyphs are visual texture; screen readers get the fields only.
- **Junk-glyph noise: at most one instance per page, and never near real content.** The reference
  gets away with saturation because it is a tattoo shop. We are claiming engineering rigour; noise
  that looks like a rendering bug costs us more than it buys.
- **Light theme is not an afterthought.** The console must read as a printed schematic (ink on paper,
  accent `#0f7d5c`) rather than a washed-out terminal. Verify both themes on every card.
- The card is **static HTML** - no canvas, no measurable JS. This is what makes it adoptable on
  content routes at zero budget.
- *Corrected in 8.8:* STATUS does **not** reuse `StatusBadge`. That component states a *project's*
  lifecycle (complete / in progress); the operator's availability is a different kind of fact, and a
  pill that looks identical to a project's would claim they are the same one (PLAN 8.2).

### 6.1 Glass - decided 2026-09-24

Every text panel on the site is one material, in the manner of Apple's glass widgets: a
translucent tint, a 1 px rim that catches light at the top-left and fades round the sides, a
sheen across the top of the pane, and a soft lift shadow. Read through the console metaphor it
is the instrument's **cover glass** - which is why it can replace "no glass" without breaking
§2: the panel is still a console readout, now behind a pane.

**Blur only where something is behind the glass.** This is the feasibility finding that shapes
the whole material. A content route has nothing with detail under its panels - the particle
rails live in the margins and never cross the 48rem reading column - so a backdrop blur there
blurs a smooth gradient into the same smooth gradient: invisible, yet a GPU pass per panel per
scroll frame, nine times over on `/projects`, on the mid-range Android the budget is written
for. So:

| Surface | Class | Blur | Why |
|---|---|---|---|
| Content-route panels - `ConsoleCard`, `ProjectCard`, the contact form's status panels, `/lab` notices and readouts | `.glass` | **no** | Nothing behind it to frost. The look comes from tint, rim, sheen and shadow over a faint ambient light |
| The sticky nav | `.glass-blur` | yes | The page scrolls underneath it |
| Every panel over a 3D canvas - `/explore` zone readouts, `/explore/lab` station screens and terminal, the overlay buttons | `.glass.hud.glass-blur` | yes | The scene renders behind it every frame; this is where frost earns its cost |

**Ambient light.** Glass needs something to be glass *over*, so `body::before` carries three
large, static radial gradients in `--accent` and a neutral at under 12% - fixed, never
animated, 0 KB of JS, and far below anything that could move body-text contrast.

**The HUD tone redefines the tokens, it does not fork the components.** `.hud` sets `--fg`,
`--fg-muted`, `--border`, `--accent` and the glass variables to the fixed dark palette locally, so
`ConsoleCard` renders correctly over a canvas with no second code path. A zone's own colour is
passed as `accent` and overrides `--accent` for that one card.

**Radius** is `--glass-radius`: 14 px on content routes, 12 px in the HUD. The 2 px near-square
corner of 8.2 was part of the rule this replaced.

**Fallbacks are part of the material, not polish:**
- `prefers-reduced-transparency: reduce` → opaque `--bg-subtle`, no blur, no sheen, no ambient light
- no `backdrop-filter` support → the blurred variants raise their tint to ~90%, so text never
  sits on an unfrosted 3D scene
- `forced-colors` → a plain `CanvasText` border; rim and sheen removed

**Liquid, and alive under the pointer - added the same day, at Suhan's request.** Three layers:

1. **Pointer light, every browser.** A pane under a mouse or pen gets a soft specular pool that
   follows the pointer, and its rim catches an accent-tinted glint on the edge nearest it. One
   delegated `pointermove` listener (`components/GlassLight.tsx`) writes `--gx`, `--gy` and a
   `data-lit` flag once per frame; everything visible is CSS. `--glint` is a registered
   `@property` so the light *eases* in and out instead of snapping - and it must be registered
   `inherits: true`, because the light is painted by `::before`/`::after`, which only see it by
   inheritance (registered `false`, the pane silently never lights; found in verification).
   Off for touch and coarse pointers, and off under reduced motion - light chasing a cursor is
   motion.
2. **Press, every browser.** `.glass-press` panes - glass you can click, today the project
   cards - lift 2 px toward the pointer and give under a press (`scale(.992)`). Readouts never
   move: the dossier or a zone panel sliding under the cursor would be a nuisance, not an
   affordance. Touch gets the press through plain `:active`.
3. **Refraction, Chromium only, blurred panes only.** An SVG displacement filter inside
   `backdrop-filter` bends the backdrop outward over the outer ~14% of each edge and leaves the
   middle optically flat - a thick sheet of glass rather than a fish-eye. The scale is a
   fraction of the pane (`objectBoundingBox`), so a chip and a readout bend in proportion. It is
   enabled by a class set only after detecting a Chromium engine, because elsewhere an SVG
   filter in `backdrop-filter` is dropped or renders nothing, and a guess in CSS risks a blank
   pane. Earlier this section declined refraction for being Chromium-only; the answer changed
   because it is now a detected *enhancement* over frosted glass that is correct everywhere,
   not the material itself. On content routes it is deliberately absent - there is nothing
   behind those panes to bend.

`/explore` zone readouts are captions (`pointer-events: none`, so they never steal the flight
controls' pointer), which means they take refraction but not pointer light. The `/explore/lab`
terminal is a control and takes both.

Implementation: `.glass`, `.glass-blur` and `.hud` in `globals.css` (PLAN 9.0). Cost measured:
**+2 KB of JS on every route** (`GlassLight`), +1 KB more on the 3D routes (`ConsoleCard` in their
client bundle); content routes 466 KB, inside the ~475 KB budget. CSS +5 KB in total.

### 6.5 Home page composition - decided 2026-08-24

`/` opens with a **summary `ConsoleCard`**, then discloses progressively on scroll, then ends at a
**gated portal** into the flythrough. Sequence:

1. **Card.** ~5 fields, above the fold: NAME, ROLE, EDUCATION, BASE, STACK, STATUS. No AGE, no
   invented quirk fields (§6). This is the first thing a visitor sees and the first appearance of the
   console metaphor.
2. **Detail on scroll.** Selected work, then the lab index - revealed with §3 scroll-driven
   animations. Rails and chrome scrub; body text never does.
3. **Portal.** A console-boot panel: schematic frame, a still (or short poster image) of the world,
   and an explicit `▸ TAKE CONTROL` action.

**The canvas mounts on activation, never on scroll.** The three.js scene is a `next/dynamic`
(`ssr: false`) chunk that is not in `/`'s initial graph, so the homepage stays at ~465 KB and remains
complete with WebGL disabled and JS off. Auto-mounting on scroll-into-view was considered and
rejected: it pushes ~1.9 MB onto a mid-range Android that did not ask for it, breaks the homepage
budget rule outright, and inverts the deliberate-entry etiquette adopted for audio in §4 - the visitor
opens the hangar door, the page does not open it for them.

Whether activation mounts the scene in place on `/` or navigates to `/explore` is an implementation
choice, not a design one; either is compliant as long as nothing 3D loads before the click. In-place
mount is preferred for continuity (§2's single-space principle) and should reuse the existing
fullscreen hook rather than a second code path - see [[explore-fullscreen]]. **Resolved by
measurement in 8.6: navigate.** An in-place mount costs a client component plus the dynamic loader on
*every* route, and buys continuity alone.

**One door, opened once - amended 2026-09-03.** Navigating shipped a defect that the design doc had
not anticipated, and it is a design defect rather than a coding one: `/explore` greets an arriving
visitor with its own `Take control`, so pressing the portal's button led to a second button with the
same two words. Two gates in a row do not read as two choices, they read as the first press having
failed. The rule the choice of navigation carries with it:

- **The gate belongs at the click that expresses the intent, not at every entrance.** The portal
  links to `/explore?fly=1` and the world starts on arrival. `/explore` reached from the nav still
  gates, because browsing to a page is not asking for ~1.9 MB. Nothing 3D is in `/`'s graph either
  way, so the etiquette above is intact - the door is still opened by the visitor.
- **Leaving returns them to where they were standing.** A visitor who chose `/explore` is *at*
  `/explore` and stays there, flying inline. A visitor who came through the portal never chose that
  page; to them it is the back of the room the door opened into, so leaving the world goes *back*,
  restoring the scroll position they left from. §2's single-space principle cuts both ways: an exit
  that strands you somewhere you never navigated to is the same broken continuity as an entrance
  that asks twice.

**Do not duplicate the dossier.** `/` gets the 5-field summary; `/about` gets the full operator card.
Two cards with overlapping-but-different field sets is worse than one card and a link.

Typography to settle at the same time, since it is the other half of "organised": mono reserved
for labels/metadata/code, and section spacing on one 8 px rhythm.

*Corrected in 8.8.* Two items that were here did not survive the build. **A custom type scale in
`@theme`** was deliberately not built in 8.1 - Tailwind's default scale was already the one scale
in use, and restating it adds a second source of truth. **A ~68-character body measure** was
declared as a `--measure` token and never adopted: the reading column is `max-w-3xl` everywhere
and prose fills it. The unused token was deleted in 8.8 rather than left as a promise.

---

## 7. Adoption order

Cheapest-first, each independently shippable, none breaching the JS budget. *As of 8.8 this is
history: items 1–8 are built (item 3 by hand, at +2 KB - §3.1), item 9 is not. Where the build
diverged, the section the item points to carries the correction.*

1. **Motion + type tokens** in `globals.css` (durations, easings, one scale). Zero visible change,
   unblocks everything else.
2. **`ConsoleCard` primitive** + the `/` summary card and `/about` operator card (§6.5). Pure CSS,
   biggest organisational payoff.
3. **View Transitions**: site-wide cross-fade, then the `ProjectCard` → project-page shared element.
4. **Scroll-driven reveals** on `/projects` and `/about` via `animation-timeline: view()`, with a
   real reduced-motion branch. The `IntersectionObserver` fallback once listed here was deliberately
   not built - §3.2 rule 0: a browser without `animation-timeline` simply shows the content.
5. **Tier-A particle field** on `/`, `/projects`, `/contact` per §5.2 - one component, a `mood` prop.
6. **Audio gate** in `/explore` and `/lab` chrome, with the persisted mute preference (§4).
7. **Interaction sound tied to motion** in `/explore` (speed) and `/lab` (hotspot focus) - last,
   because it is the easiest to get wrong and the least missed if dropped.
8. **Home portal section** (§6.5) - static panel first, then wire the gated lazy mount. Ships after
   the card and the scroll reveals, because it is only worth building once the scroll journey that
   leads to it exists.
9. Optional: **session-once intro schematic** on `/`, sub-20 KB, skippable.

## 8. Guardrails to re-check before each of the above ships

- Per-route JS measured with headless Chromium, one fresh context per route. The harness anchors,
  re-baselined in 8.8 (2026-09-24): `/lab` **1,411 KB** and `/lab/ascilam` **1,397 KB** - if a
  re-run of an unchanged build does not reproduce them, the harness is lying. (The old anchors,
  1,402 / 1,395, predate the 8.7 audio toggle; the last commit measures 1,409 / 1,396, and 8.3 adds
  the remaining 2 KB to every route.)
- Content routes still under ~475 KB and still free of three.js **in the initial graph** - for `/`,
  measured before the portal is activated, and confirmed that activation is what pulls the chunk.
- Nothing on the render path fetches from a network - including decoders and fonts.
- `prefers-reduced-motion` branch verified by hand, not assumed from the global CSS rule.
- Keyboard path intact through every new control (audio toggle included).
- Both themes checked; body-text contrast measured with the particle field on.
- WebGL-disabled and JS-disabled states still show full content. **Run this one, do not assume
  it:** the 8.8 run found `/lab` blank without WebGL - a hook placed below the no-WebGL early
  return (added in 8.7) made React throw #300 on hydration. Three other scenes with the same
  structure were fine, which is exactly why reading the code was not enough.

---

## 9. The world's own furniture - decided 2026-08-24

`/explore`'s zone panel reads as the website intruding on the scene, and the fix is to split
the frame from the text.

**The frame becomes diegetic.** A kiosk/screen model at each zone, in the schematic language,
plus the panel restyled as an instrument readout on `ConsoleCard` rather than a floating card.
One model instanced nine times, never nine models.

**The text stays text.** Body copy renders as DOM on the screen's face via drei
`<Html transform occlude>` - mapped into 3D space, occluded by geometry, billboarding to face
the visitor on docking, and still selectable, indexable and screen-reader reachable. Baking
copy into a canvas texture or an SDF atlas is refused: Igloo can draw its type in shaders
because it has no long-form content and no recruiter reading it on a train. The rule from
2026-08-22 holds - the world cannot say something the site does not, and a visitor with WebGL
off gets every word.

**Navigation is guided, not instant.** A waypoint ribbon of additive particles is drawn from
the craft to the selected zone before the flight begins, so a jump button's effect is legible
instead of magic; auto-flight yields the moment the visitor touches a control. Teleport is the
`prefers-reduced-motion` branch and nothing else - a cut destroys the spatial memory that is
the only reason to fly a world rather than read a list.

**The arena grows only if a kiosk proves it must.** Fog is 60–190 against a 120-unit world
whose diagonal is ~170, so widening the plate adds travel through grey. Build one kiosk, place
it at one zone, fly it. If it is crowded, go up - the flight volume is 1.2–34 and almost unused -
before going out.

Schedule: PLAN.md Phase 9, sequenced after 8.2 and after the outstanding mid-range Android pass.

---

## Sources

- [Igloo Inc - Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)
- [Igloo Inc: Crystal Growth Algorithms, Shader-Driven UI, and Volume Data - webgpu.com](https://www.webgpu.com/showcase/igloo-inc-procedural-crystals/)
- [Igloo Inc - Awwwards Site of the Day](https://www.awwwards.com/sites/igloo-inc)
- [Landing Site - Igloo Inc, three.js forum](https://discourse.threejs.org/t/landing-site-igloo-inc/67249)
- [Igloo Inc](https://www.igloo.inc/)
- [IRIS K - Welcome](https://theirisk.com/welcome)
- [Chrome Tattoo Paris - Profile](https://chrometattooparis.com/profile)
