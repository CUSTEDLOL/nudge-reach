# Landing v2 — "The Night Shift" immersive 3D scroll experience

**Date:** 2026-07-06 · **Branch:** `landing-v2` · **Status:** approved by user
**Positioning source of truth:** `docs/STRATEGY.md` (AI Front Desk, not a WhatsApp CRM).
Supersedes the truncated `docs/LANDING_V2_DIRECTION.md`.

## Goal

Replace the v1 landing page wholesale with a single-page immersive 3D scroll
experience that sells the AI Front Desk. The page must dramatize the three
moats (real actions, outbound chasing, done-for-you) — not list features.

## Decisions made (user-approved)

1. **Concept:** keep "The Night Shift" — the page is one shift, 11:47 PM →
   9:00 AM; **scroll is time**. Fresh concepts folded in: a fixed HUD clock
   that ticks with scroll, a night→day theme morph across the whole page, and
   a 3D message-stream flythrough.
2. **Architecture:** **one persistent WebGL world** — a single full-viewport
   R3F canvas alive for the entire page; scroll scrubs one master timeline
   (sky grade, camera path, chapter scenes). No per-section canvases.
3. **3D everywhere, full page:** the world does NOT fade out at morning — it
   becomes a daylight world (morning sky, light motes, gentle depth) and the
   pricing/features/FAQ sections float as animated cards inside it.
4. **Both platforms, highest fidelity:** full 3D on desktop AND mobile, with
   adaptive quality tiers so capable devices get the maximum show and weak
   devices degrade gracefully (never a slideshow, never desktop-only gating).

## Narrative / page map (scroll order)

| Scroll time | Chapter | Sells |
|---|---|---|
| 11:47 PM | **Hero** — night sky, particles, aurora; "Your best employee doesn't sleep." | The USP (upgrade of existing `hero-v2.tsx`) |
| 12:31 AM | **It answers** — camera flythrough of 3D WhatsApp chat cards, AI replying instantly | Grounded instant answers |
| 2:15 AM | **It books** — a calendar assembles in 3D; a slot clicks into place | Moat 1: real actions in real systems |
| 4:40 AM | **It chases** — ghosted-lead cards drift away and get pulled back into orbit | Moat 2: outbound follow-up (Meta's free agent is inbound-only) |
| 6:48 AM | **Dawn** — sky grades to dawn; payment link paid; reminders sent | The night's work compounds |
| 9:00 AM | **Morning payoff** — owner's phone shows the night: bookings made, leads recovered, ₹ collected (animated counters) | The emotional sell |
| Morning | **Meta vs Nudge → Salary math → Industries → Features → Reseller → Pricing → FAQ → Final CTA → Footer** | All v1 content, floating as `FloatCard`s in the daylight world |

The night chapters (~6–7 viewport-heights) are pinned, scroll-scrubbed
sections. The morning zone scrolls conventionally but stays inside the same
canvas world with scroll-reveal choreography.

## Technical architecture

**Server-first; 3D is décor.** `src/app/page.tsx` stays a server component:
metadata + every section's copy as real server-rendered HTML. SEO, LCP and
no-JS reading never depend on the canvas.

**Stack (already installed):** GSAP + ScrollTrigger, Lenis, three.js +
@react-three/fiber. No new dependencies without a named reason.

```
src/components/marketing/v2/
  experience.tsx      # client orchestrator: Lenis↔ScrollTrigger, master
                      # timeline, mounts canvas, publishes scroll progress
                      # 0→1 via a shared ref (no state library)
  world/
    world.tsx         # the single fixed canvas + adaptive quality
    camera-rig.tsx    # scroll-driven camera path through chapters
    sky.tsx           # night→dawn→morning gradient + fog, scrubbed
    particles.tsx     # nightfield that morphs into daylight motes
    message-stream.tsx# instanced 3D chat cards (flythrough)
    calendar.tsx      # assembling booking scene
    orbit.tsx         # lead-recovery scene
  chapters/           # DOM overlays per night chapter (pinned copy, HUD clock)
  (daylight zone)     # reuse v1 section components wrapped in FloatCard
```

**Scroll plumbing:** one master ScrollTrigger maps document scroll to a
progress value the R3F `useFrame` loop reads via ref; per-chapter
ScrollTriggers pin and choreograph DOM copy. Lenis drives scroll;
`lenis.on('scroll', ScrollTrigger.update)`.

**Quality / performance:**
- Device tiering at mount (GPU renderer string, `deviceMemory`,
  `hardwareConcurrency`) selects particle counts, effect toggles, DPR cap
  (up to 2 on capable devices). R3F `PerformanceMonitor` steps quality down
  live on frame drops.
- three.js chunk lazy-loads on idle; hero text is server HTML and paints
  first. Frameloop pauses when the tab or canvas is hidden.
- Budget: added client JS ≤ ~250 KB gz (three+R3F dominate); 60 fps target
  on desktop, ≥30 fps on low-tier mobile at reduced quality.

**Fallbacks (non-negotiable):** `prefers-reduced-motion` or WebGL
unavailable → no canvas, no pinning, no scroll hijack; a designed static
night→day gradient page with all content readable. Same experience for
no-JS/crawlers. Canvas is `aria-hidden`; all narrative copy is real DOM text;
contrast maintained through the theme morph.

**Deletions / survivals:** v1 `Hero` + `SocialProof` composition replaced
wholesale in `page.tsx`. v1 sections that survive do so inside the daylight
zone (MetaVsNudge, SalaryCalculator, Industries, FeaturesBento, ResellerCTA,
Pricing, FAQ, FinalCTA, Footer), restyled minimally. `waitlist`, `login`,
`privacy`, `terms` routes untouched. Unused v1 components are deleted once
the v2 page ships.

**Repo invariants:** marketing surface only — no runtime AI, no consent or
messaging paths touched; simulation-mode demo unaffected.

## Testing

- Unit tests for the deterministic bits: device-tier picker, chapter
  timeline math (scroll progress → time-of-day/clock), clock formatter.
- `npm run build`, lint and the existing test suite stay green every commit.
- End-to-end: actually scroll the page in Chrome (desktop + mobile
  emulation + reduced-motion) before claiming done.

## Out of scope

Waitlist flow changes, new copywriting strategy (copy follows the approved
one-liner), video assets (the existing optional `a1-hero-loop` stays
optional), analytics.
