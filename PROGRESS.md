# PROGRESS — Nudge Reach (WhatsApp)

Build log. Newest phase at the top. Each entry: what was done, decisions made,
what's next.

---

## Launch-readiness pass — signup, AI-first onboarding, per-org test mode (2026-08-25) ✅

Audit of the real lead path on production (real signup, real confirmation
email, headless walk of onboarding → every page) and the fixes it demanded.

- **Signup was broken for real leads**: Supabase's Site URL was still
  `http://localhost:3000`, so confirmation links bounced leads to localhost;
  and `/auth/confirm` only accepted `token_hash`, not the PKCE `code` the
  default emails carry. Route now handles both. **Supabase dashboard must
  also be set** (Site URL → nudgeagent.app, redirect allowlist, token_hash
  email templates) — see the founder TODO below.
- `/login`: Forgot-password → reset email → `/auth/reset`; stale-link
  errors explained (`?error=confirm|auth`, read by a server page wrapper);
  "Sign in with Google" renders only with `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1`
  (the provider is off in Supabase — the button errored for every click).
  Navbar has a Sign in link again.
- **AI-first onboarding**: `/inbox/try` lets a fresh workspace message its
  own AI as a customer (the tester used to live only inside an existing
  thread, so a new account had no way to see the agent). Linked from the
  dashboard header, quick actions, empty inbox, AI Agent page. Dashboard
  checklist is Teach your AI → Try your AI → Connect WhatsApp → contacts →
  campaign; "New broadcast" is no longer the dashboard's primary button.
  Wizard copy is AI Front Desk first; the auto "<email>'s shop" name isn't
  prefilled anymore.
- **Settings → WhatsApp** is concierge-first: what to have ready + "Book your
  setup call" (Cal.com); the WABA/token form sits under Advanced; the go-live
  checklist speaks to the owner (env-var items gone).
- **Per-org test mode** (`Org.simulated`, default true): `modules/orgs/mode`
  (`sendModeFor` / `isSimulated` / `orgSendMode`) replaces every
  `env.SEND_MODE` check in app + modules. Global `SEND_MODE=simulation` still
  mocks everything (invariant #4); in a live deployment an org stays mocked
  until `saveWhatsappAccount` connects a number (flips `simulated=false`).
  The `/demo` sandbox and fresh signups therefore never touch Meta even once
  prod is flipped to live. Owner-facing copy says "Test mode", never
  "simulation". Backfilled: orgs with a connected number → `simulated=false`.
- Demo CTAs: the hover launch scene is gone; `LaunchDemoButton` is a plain
  Cal.com trigger.
- Tests: `tests/org-mode*.test.ts`, dashboard checklist tests updated.
  56 files / 430 tests, lint, tsc, production build green.

### Founder TODO
- Supabase → Authentication → URL Configuration: Site URL
  `https://nudgeagent.app`; Redirect URLs `https://nudgeagent.app/**`,
  `http://localhost:3000/**`. Email templates → Confirm signup:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard`;
  Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset`.
- Flip prod `SEND_MODE` to `live` when the first client connects (safe now —
  every other org stays in test mode).

## USDC payment rail + hosted pay page + guest demo sandbox (2026-08-14) ✅

Built for the NTU InnovateX 2026 hackathon (Track 2: Web3 Applications, AI
Agents and Real-World Use Cases) — and kept product-true: it strengthens
moat #1 (real actions: payments) without touching strategy or invariants.

- **`usdc` payment rail** in `modules/payments`: `createPaymentLink` takes an
  optional `rail` (`fiat` default — zero behavior change for existing callers).
  USDC requests are currency `USDC`, never touch Razorpay, and are served by
  our own hosted pay page. Live settlement driver (AIsa) lands when sponsor
  API access is provisioned; simulation serves the full flow today.
- **Agent tool**: `send_payment_link` gained an optional `method` (`standard` |
  `usdc`) — the agent offers USDC only for cross-border customers or on
  explicit request. Flagship gate and amount bounds unchanged.
- **Hosted pay page `/pay/[id]`**: public-by-unguessable-id customer page
  (amount, purpose, network/asset/address/reference, clearly-labeled test
  mode). Simulation rows settle via a server action guarded on
  `provider === "simulation"`; fiat simulation links now point here too
  (previously a dead placeholder domain).
- **x402 machine endpoint `GET /api/pay/[id]`**: unpaid USDC requests answer
  HTTP 402 with structured payment instructions (scheme/network/asset/amount/
  payTo/reference); paid ones answer 200 with the receipt.
- **Guest sandbox `GET /demo`**: one-click judge access — anonymous Supabase
  sign-in, fresh isolated org, demo seed, straight to the dashboard. Rate
  limited per IP; no auth-flow changes; requires "Allow anonymous sign-ins"
  in Supabase. Session proxy PUBLIC_PATHS extended: `/pay`, `/api/pay`, `/demo`.
- Tests: new `tests/usdc-rail.test.ts` (rail default, USDC row shape, gate,
  bounds, tool mapping); `payment-link` sim-URL assertions updated. 54 files /
  425 tests, lint and production build green.
- **Demo re-theme**: the demo seed is now "The Spice Garden" restaurant —
  international guest names, English dining threads (reservations, private
  dining deposit, catering negotiation, STOP flow, cold-delivery escalation),
  restaurant knowledge (incl. the 6+-group ₹2,000 deposit and USDC-for-
  international-guests facts that ground the on-chain payment demo).
  `scripts/seed-demo-org.ts` now fully resets front-desk state + CRM data.

## Landing-page responsive production pass (2026-07-22) ✅

- Audited every public landing section at 320×568, 360×800, 375×667,
  390×844, 430×932, 768×1024, 1024×768, 1280×800 and 1440×900, plus
  568×320 and 844×390 landscape. Added
  `scripts/audit-landing-responsive.mjs` as a repeatable, dependency-free
  Chrome/CDP rig for section screenshots, overflow, target size, hydration,
  console/network and interaction checks.
- Kept the compact mobile navbar through tablet widths, added safe-area-aware
  placement, 44px controls, Escape handling, scroll-lock restoration and an
  internally scrollable short-viewport menu.
- Removed the industry word-search scroll gate (scroll-jacking) while retaining
  the game: phones/tablets now get explicit 44px reveal controls; desktop keeps
  hover/focus discovery.
- Re-composed the pinned Night Shift for short portrait and landscape screens
  so chapter copy and the phone never mask each other.
- Made the access modal keyboard- and mobile-safe: 16px inputs, autocomplete,
  initial/return focus, 44px close control, safe-area spacing and scrolling when
  the keyboard or landscape viewport reduces available height.
- Fixed the 768px navbar collision, the 320px footer-headline clip, scorecard
  and footer tap targets, touch-only holo wording, and the missing grain-image
  request.
- Final production sweep: zero page overflow, console errors or failed network
  resources at all 11 viewports; menu and modal open/lock/close behavior passed;
  no sub-44px controls below 1024px. `tsc`, lint, 53 files / 418 tests and the
  production build are green.

## Collectible-card footer (2026-07-18) ✅

- Replaced the generic dark green marketing footer with a pale grid-backed
  footer that matches the landing page's bold editorial card language.
- Added a Nudge action collectible card that explains the AI Front Desk through
  product moves, WhatsApp-style messaging, and stat chips for books / chases /
  collects.
- Added a chunky grass strip as the final visual edge of the website.

## Navbar restored after pull (2026-07-18) ✅

- Restored `src/components/marketing/navbar.tsx` to the pre-pull local version
  from commit `57ba352` so the navbar keeps Vishesh's pixel-slab treatment
  instead of the newer sweep animation introduced by the merge.
- Preserved the intended scroll handoff: the slab starts white over the hero
  and recolors to ink as the navbar transitions into the solid scrolled state.

## Comparison becomes a game roster (2026-07-18) ✅

Founder review: the kinetic market map read as "very AI" — a sterile
scatter chart. References supplied (Fibery's biased hand-drawn
comparison, beehiiv's bold block, Surfshark's elevated winner column)
plus a brief: gamified, colourful, matching the bento.

### Done
- `meta-vs-nudge.tsx` rebuilt as **THE SCORECARD** — a player roster.
  Every contender is a game card in the bento's exact language (2px ink
  border, hard 7-9px offset shadow, saturated gradient, giant ghost
  score bleeding off the corner). Five stats — Answers / Books / Chases
  / Collects / Runs itself — render as chunky 3-segment power bars.
- Scores are the retired capability ledger translated 0-3 (empty =
  doesn't, half = only once you wire it, full = does it), so the playful
  framing sits on the same defensible data: Meta 4/15, the three CRMs
  6/15, a hire 10/15, Haptik 11/15, Nudge 15/15.
- Ranked leaderboard: Nudge is the full-width champion card (crown,
  RANK 01, stat sheet on frosted glass); the other six follow as
  numbered cards, sorted by score.
- Honesty device borrowed from Fibery — a rotated "BIASED SCORECARD ·
  HONEST DATA" stamp up top and a footnote owning the bias.
- Static by design: the only motion is a 1px hover lift. Deleted the
  187-line market-map CSS block (nodes, impact keyframes, axis labels,
  grid, responsive overrides) — zero orphaned references.

### Verification
- Screenshots at 1440 and 390: full roster reads correctly, ghost
  scores legible, no mobile horizontal overflow.
- 418 tests, lint, build, `git diff --check` — green.

## Landing hero video + permanently open color bento (2026-07-18) ✅

- Replaced the hero loop with the founder-supplied `Finale.mp4` and generated a
  matching first-frame poster so the fallback no longer flashes the old scene.
- Removed the bento hover gate, resting nameplates, per-card reveal effects,
  animation timers, motion wrappers, and touch/reduced-motion branching.
- Rebuilt all five cards as immediately visible product panels with copy and
  imagery open by default, using strong lime, orange, electric-blue, violet,
  and emerald palettes with dark borders and hard editorial shadows.
- Verified the new static composition at desktop and narrow breakpoints.
- Follow-up refinement removed capability numbering and the inner framed-image
  boxes. Artwork now floats directly on each color field with varied editorial
  scale/placement and large background words for a container-free, asymmetric
  magazine rhythm while preserving a unified outer grid.
- Rebalanced each asset against its own source aspect ratio: copy is top-anchored,
  landscape artwork enters immediately after the description, and safe-area
  scaling keeps the full analytics/integrations compositions inside the card.

## Landing comparison — kinetic market map (2026-07-18) ✅

- Replaced the dense capability ledger with a two-axis qualitative market map:
  answer depth → revenue actions, and owner-operated → runs for you.
- Positioned Meta AI, AiSensy, WATI, Interakt, Haptik, a human hire, and Nudge
  as selectable brand nodes; each opens a concise evidence panel rather than
  forcing visitors to scan a spreadsheet.
- Added a one-shot kinetic sequence with staggered node impacts, shock rings,
  a diagonal software ceiling, Nudge breakthrough debris, and chart recoil.
  Nodes are permanent DOM end states, so interrupted animation can never hide
  or partially erase them.
- Added dedicated narrow-screen coordinates, reduced-motion fallbacks, keyboard
  selection, responsive evidence cards, and desktop/mobile visual verification.

## Landing bento — five finite signature reveals (2026-07-18) ✅

- Replaced the shared strip treatment with a different finite reveal for every
  card: AI pixel storm/core collapse, broadcast signal rings, analytics data
  columns, integrations orbital wedges, and green-tick verification slashes.
- Gave each feature a matching title entrance instead of replaying the same
  word motion five times.
- Added an explicit 4.7-second settled state: effect layers unmount after the
  crisp image resolves, so nothing loops or keeps moving under a held hover.
- Hardened the final handoff: assembled image layers now hold at full opacity,
  the crisp source resolves above them with an 850ms safety margin, and layer
  removal is visually identical instead of causing a partial-image flash.

## Landing bento — 4.6s editorial hover sequence (2026-07-18) ✅

- Halved the revealed feature-heading scale after founder review while keeping
  it as the boldest element in the card.
- Replaced the fast fragment burst with a deliberate 4.6-second sequence:
  staggered title words, calm supporting copy, alternating vertical image
  strips, a soft scan pass, and a final sharp-image resolve.
- Kept hover exit immediate and preserved static touch/reduced-motion fallbacks.

## Landing bento — cinematic hover assembly (2026-07-18) ✅

- Rebuilt hover hierarchy around the actual feature name: large, black display
  type enters word-by-word; the supporting promise and description stay quiet.
- Each product illustration now assembles from 24 deterministic image fragments
  before resolving into the crisp source image, with no canvas/runtime random
  cost and static fallbacks for touch and reduced-motion users.
- Deepened the five individual hover themes slightly while preserving the
  outlined resting labels, dark boundaries, fixed card geometry, and layout.

## Landing bento — stronger resting state + color themes (2026-07-18) ✅

- Kept the original outlined display labels, but strengthened their stroke so
  every feature reads before hover without losing the distinctive type style.
- Darkened each bento card boundary and strengthened the resting shadow while
  preserving the existing hover reveal, dimensions, and responsive behavior.
- Replaced the near-identical pale-green hover tints with richer individual
  themes: mint, warm sand, sky blue, lilac, and sage.

## Payments in chat + AI Agent page (2026-07-18) ✅

Feature 1 of the competitive build-out (payments → ingestion → reschedule →
multi-language → tool-calling → catalog → staff booking).

- **`send_payment_link` agent tool** — the missing "collects payments" action.
  New `modules/payments`: Razorpay Payment Links in live mode, simulation links
  otherwise (cron flips them to paid after ~90s so the deposit story demos with
  zero keys). Flagship plan-gated like booking; amount bounds enforced;
  `payment_link.paid` webhook marks rows paid idempotently. `PaymentRequest`
  model added. Tests: `tests/payment-link.test.ts` (7).
- **AI Agent page** — `/agent` top-level in the sidebar (Training tab = owner
  question queue + facts library; Setup tab = persona). `/knowledge` and
  `/settings/agent` 301 there.

### Next
- Ingestion suite: website crawl / PDF / menu-photo / Google Business Profile
  → draft facts the owner confirms card-by-card (replaces questionnaire-first
  onboarding).

## Strategy pass — trajectory sharpened + Meta compliance documented (2026-07-16) ✅

Founder direction across a research + planning session. No code changed; planning
docs rewritten to match the current trajectory.

### Decisions locked
- **Number-ownership constraint.** A WABA connects to one provider at a time —
  we cannot be a "replies bolt-on" beside AiSensy. We must **own the number
  end-to-end**, so the ICP is a business where WhatsApp IS the sales counter.
- **Beachhead sharpened** from generic "clinics/salons" → **high-ticket lead-gen
  clinics**: hair-transplant, aesthetic/derma, cosmetic-focused dental, IVF.
  Study-abroad consultants = chase-moat pilot. **Salons/spas/gyms dropped as
  targets** (blast-first, low-ticket). Grounded in speed-to-lead + no-show
  economics + India vertical data.
- **Marketing is IN — opt-in only.** WhatsApp marketing is a real revenue lever;
  the sole hard rule is recipients opted in. Bans come from consent, not volume;
  cold-drip "warming" does not work. Audience = the client's own first-party
  list; **no paid ads required.** Legit "warming" = earning Meta tier upgrades
  (250 → 1k → 10k …) via quality.
- **Access path:** per-client manual (first ~1–10) → Tech Provider (incorporate +
  Meta Business Verification + App Review + Embedded Signup). Solution Partner /
  Model B later. Client's own verification controls the 250→1,000 limit.

### Docs written / rewritten
- New: `docs/META_COMPLIANCE_INBOUND.md`, `docs/META_COMPLIANCE_MARKETING.md`.
- Rewritten: `docs/STRATEGY.md` (§2 number-ownership, §5 access path, new §5a
  beachhead, §7 opt-in marketing, §9 drift test), `AGENTS.md` (positioning +
  beachhead lines; invariants untouched), `docs/PRD.md` (reframed from the
  one-way "Nudge Reach" marketing tool to the two-sided AI Front Desk),
  `docs/WHATSAPP_AUTOMATION_STRATEGY.md` §4 (vertical ranking).

### Next (build implications, not yet started)
- Opt-in **source + timestamp** record in onboarding/import; audience picker
  hard-gated to `optedIn` with consent source shown at send time.
- Embedded Signup (self-serve WABA connect).
- Messaging-tier + quality-rating display in the dashboard.
- Migration-consent checkpoint (client acknowledges losing app access + chat
  history before migrating a number to Cloud API).
- App Review submission (gates scale; slowest step — start early).

## Night Shift — showcase box, alternating phone + companion panels (2026-07-14) ✅

Founder direction: put a box around the phone, have it hop sides each
chapter (L→R→L→R), and play a feature companion on the vacated side.

### Done
- New `chapters/showcase.tsx`: the bordered showcase box beside the copy
  rail. One scrubbed timeline moves the phone between sides at chapter
  boundaries and hands off four companion panels: floating customer
  questions (answers), a straight-on July calendar where the 18th pops,
  a "Saturday · 9:00 PM" pill lands and a tick draws (books), a lead
  list whose "quiet Nd" badges flip to "follow-up sent ✓" one-by-one
  (chases), and a "₹500 received" receipt + Razorpay/Stripe/WhatsApp
  Pay/UPI brand chips (collects; simple-icons path data inline).
- Desktop-only via `gsap.matchMedia`; mobile dissolves the box chrome
  and keeps the phone bottom-center. No-JS/reduced-motion: everything
  stacks in flow, fully visible (same `.jsm` gate pattern).
- Fixed missing spaces after `</strong>` in two copy beats (compiler
  strips the leading space of the following text node).

### Verification
- Headless-Chrome screenshots at 5 scroll depths, 1440×900 + 390×844:
  phone side per chapter, mid-flight transition (header shows
  "typing…"), calendar/tick beats, badge flips, payment chips; found
  and fixed a stagger that outlived its panel's exit envelope.
- Build + lint + 392 tests green.
- NOT included: a concurrent local edit to `marketing/industries.tsx`
  (not part of this task; left uncommitted).

## Night Shift — WhatsApp phone mock replaces the WebGL world (2026-07-14) ✅

Founder verdict on the 3D chapter scenes: flying bubbles and the tilted
calendar felt abstract; wanted the four chapters to play as ONE WhatsApp
conversation on a phone — "exactly like a mock WhatsApp thing", no gray
browser box. Reference screenshot supplied.

### Done
- New `chapters/phone.tsx`: a WhatsApp-exact phone mock (header with
  avatar/online, doodle wallpaper, bubble tails, ✓✓ ticks, time chips,
  composer) pinned where the browser box was. One continuous customer
  thread ("Priya") spans the four chapters — asks & answers (12:31 AM),
  books 9 PM + straight-on calendar card whose tick draws in (2:15 AM),
  gets chased with a follow-up (4:40 AM), pays a ₹500 deposit link with a
  UPI receipt chip (6:48 AM). Every item pops in at its story beat and the
  thread auto-scrolls; the header flips to "typing…" before her messages.
  All scrubbed off the same CHAPTERS spans as the copy rail.
- Removed the entire WebGL world (`v2/world/` — sky, camera rig, message
  stream, calendar, orbit, collect, stage, quality, textures) and the
  browser-box + mask CSS; dropped `three`, `@react-three/fiber`,
  `@types/three` from deps. `progress.ts` trimmed to just CHAPTERS.
- No-JS/reduced-motion fallback: the phone sits in normal flow with the
  full transcript visible and scrollable (same `.jsm` gate pattern).

### Verification
- Build + lint + full suite green (392 tests; world/stage/quality/camera
  tests removed with their subjects, progress test trimmed to CHAPTERS).
- Served page contains the phone markup; no `ns-browser`/`ns-world-mask`
  remnants.

## Hero image shipped — cinematic still-life (2026-07-14) ✅

Art direction converged over four founder iterations: photoreal night scene
(too dark for the white site) → full cartoon (too childish) → semi-real
shutter scene (people distracted from the product) → final: a no-people
cinematic still-life. Closing time on a salon counter: keys down, chai
steaming, the phone upright showing a WhatsApp-style chat, glossy green
bubbles floating up like steam. Semi-realistic stylized 3D, warm cream/mint
palette — the same world as the rest of the page.

### Done
- Founder-generated image placed at `public/hero/front-desk.jpg` (PNG →
  JPEG q88, 1.7MB → 275KB). The hero's light treatment (previous entry)
  fits it: ink headline on the image's empty left wall, white legibility
  gradients, glass chat toast landing beside the rendered cup.
- Mobile: phones crop to the image's busy right side, so a phone-only
  vertical white wash (`sm:hidden`) keeps the text zone readable while the
  counter ghosts through below the CTAs.

### Verification
- Screenshots at 1440×900 and 390×844 with the real image — headline
  contrast, toast placement and mobile wash all verified.
- Full suite + lint + build + `git diff --check` — green.

## Photo hero + de-grey pass (2026-07-14) ✅

Founder direction with Manychat/Intercom references: the opening viewport
should be a full-bleed photograph with type over it; kill the magnetic
buttons; replace the light-grey card fill.

### Done
- **Hero rebuilt photo-first** (`v2/hero-v2.tsx`): full-bleed `next/image`
  slot (`public/hero/front-desk.jpg`) over a deep-green night gradient that
  IS the look until the photo ships (and the no-photo fallback — the image
  hides itself on 404). Cinematic legibility grade (dark left third, bottom
  and top vignettes), white display headline with brand-green second line,
  trust row (official API / real calendar / payments), and the overnight
  ledger reduced to a quiet glass chat toast riding the photo's lower right.
  GSAP intro + scroll-drift preserved (same class hooks).
- **Navbar over photo**: new `overDark` prop — light-on-dark links/logo/
  toggle while the wide bar rides the hero, unchanged white pill on scroll.
- **Magnetic buttons removed** everywhere (features, partners, final CTA);
  buttons no longer chase the cursor.
- **Card fill de-greyed**: `#f4f6f5`/`#fafbfa` replaced with soft brand
  mint (`#edf7f1` cards, `#f3faf6` table/partners/footer) with emerald-
  tinted hairlines — tilt/spotlight system untouched.

### Blocked (founder decision)
- The actual hero photograph: Higgsfield CLI account is on the free plan
  (`job_minimum_basic_plan_required`), so generation is blocked. Options:
  top up Higgsfield, approve a free-license stock photo, or drop any image
  at `public/hero/front-desk.jpg` — the hero picks it up as-is.

### Verification
- Screenshots at 1440×900: hero (gradient fallback) and mint feature cards.
- Full suite + lint + build + `git diff --check` — green.

## Daylight zone — physical depth pass (2026-07-13) ✅

Founder verdict on the re-skin: too flat. Kept the minimal language, made the
cards physical — the 2026 pattern set (multi-axis tilt, layered Z-depth,
cursor-tracked spotlight border, glare, layered shadows).

### Done
- New `TiltCard` primitive (`marketing/tilt-card.tsx`): spring-damped 3D tilt
  toward the cursor, brand-green border glow + interior spotlight + white
  glare that follow the pointer, hover lift with a deep soft shadow. Children
  opt into real Z-depth (`translateZ`) — icon chips float 34px above the card
  plane, titles 22–24px, body copy ~10px, so the card reads as layered glass
  when tilted. Touch and reduced-motion get the same static card.
- `TiltChip`: white icon chip with brand-green icon, soft drop shadow and
  inset highlight — cards read tactile even before hover.
- Applied to all 4 feature cards and all 6 industry cards.
- Comparison table: deep soft elevation + inset top light on the card, row
  hover highlight, and the NUDGE column lifted as a physical rail (rounded
  header with green glow, rounded tail).
- Magnetic cursor-pull on the section CTAs (features, partners, final CTA).
- Ambient radial brand washes behind the partners band and final CTA; the
  lead form sits in a cursor-following spotlight (no tilt — it's a form).

### Verification
- Hover states screenshot-verified at 1440×900 with the headless rig (mouse
  moved onto specific cards): tilt, spotlight, chip depth and shadows all
  render; non-hovered cards stay minimal.
- Full suite + lint + build + `git diff --check` — green.

## Daylight zone — minimal re-skin after ConverSimple reference (2026-07-13) ✅

Founder supplied conversimple.com as the visual reference for everything
below the Night Shift animations. Studied the reference with headless-Chrome
captures, then re-skinned the lower half to its language: centered
compositions, generous whitespace, soft grey cards, and the caps-sans +
quiet-serif headline pairing (new `.serif-display` utility, system Georgia).

### Done
- **Features:** four centered grey cards (inbox, leads, compliance,
  measurement) under "SOFTWARE YOUR EMPLOYEE USES / Not software you have to
  run.", concierge line + two pill CTAs.
- **Comparison:** centered caps+serif heading; the ledger table now sits in a
  soft rounded card; bold dashes kept.
- **Industries:** six centered grey cards with icon, bold title, serif
  outcome line and short body.
- **Reseller:** quiet centered band on faint grey with an outlined CTA.
- **Final CTA:** light and centered — "YOUR CUSTOMERS ARE / already on
  WhatsApp." + buttons + inline check-points + the lead form in a narrow
  centered card. Dark mesh panels removed.
- **Footer:** light re-skin (same links/columns).
- **SectionHeading** (shared with /pricing, /faq) recentered to the same
  minimal system.

### Verification
- Screenshot pass over all five sections at 1440×900 — visually matches the
  reference language; no clipping or overflow.
- Full suite + lint + build + `git diff --check` — green.

## Landing fix sprint — founder review round (2026-07-12) ✅

Seven fixes from live-page review, each screenshot-verified at 1440×900 and
390×844 with the scratchpad headless-Chrome rig.

### Done
- **Plain white showcase box**: removed the WebGL particle field, the CSS
  grid overlay, the golden motes and the tinted sky — the box interior is
  now pure white (the box background is transparent; the world provides the
  white, which a first pass got wrong and blanked the scenes).
- **High-resolution scene graphics**: calendar slot textures now draw at
  2.5×, chase/collect bubbles at 3×, corridor messages at 2.5×, anisotropy
  8 — crisp at the new box-filling sizes on retina screens.
- **Hero de-AI'd**: the "Night shift · Live activity" ledger card replaced
  with a concrete WhatsApp conversation mockup (Sunrise Dental: enquiry →
  7:30 PM offer → booked → ₹500 UPI receipt), pure HTML/CSS so it is
  resolution-independent; heading reduced one size step.
- **Redundancy removed**: the "You slept. It didn't." morning stats section
  and the features "The job" 4-verb block are gone (both repeated the four
  chapters); features now leads with "the desk behind it". The salary
  calculator moved to /pricing under the plan cards; nav/footer anchors
  updated; the world's after-trigger retargeted to #daylight.
- **Bold pass**: comparison-table dashes are now bold and visible; key
  fragments bolded across hero, chapter copy and the comparison subtitle.
- **Navbar**: full-width at the top of the page (logo hard left, CTAs hard
  right), easing into the compact pill on scroll; scrolled pill is
  bg-white/90 + blur instead of the lighter glass.
- **SEO**: robots.ts, sitemap.ts, generated OG image (next/og), SVG favicon,
  Organization + SoftwareApplication JSON-LD on the home page, FAQPage
  JSON-LD on /faq (FAQ data split into faq-data.ts so server components can
  read it); middleware allowlists the SEO artifacts.

### Verification
- `npm run lint`, `npm run build`, `git diff --check` — green.
- **421 tests / 52 files** — green (palette module and its tests removed
  with the tinted sky).

## Night Shift box utilisation — exact projection framing (2026-07-12) ✅

Founder review: Books/Chases/Collects sat cramped against the showcase box's
left edge (Answers was right). Root cause: scene placement used hand-tuned
world offsets that only line up at one aspect ratio — the box is a CSS
construct (right 48vw on desktop, lower half on phones) and its NDC centre
never matched the look-axis on other viewports.

### Done
- New `world/stage.ts` — `placeStage()` projects each scene's visual-centre
  anchor through the live camera, unprojects the BOX centre at the same
  depth, offsets the group by the difference and uniform-scales the
  composition about the anchor to fill ~88% of the box (94% on phones,
  readability-capped at 1.2–1.3×). Exact at every aspect ratio; replaces all
  per-scene squeeze/offset magic in calendar, orbit and collect.
- Calendar cards keep the camera-quaternion billboard (removed the rotation
  reset that was cancelling it); collect's typing indicator moved inside the
  scene group so it inherits the same transform.
- Screenshot-verified at 1440×900, 1920×1080 and 390×844: all three scenes
  centred in the box, filling it, nothing clipped; Answers untouched.

### Verification
- `tests/landing-stage.test.ts` — anchor lands on the box centre at 5 aspect
  ratios, edges stay inside the box, depth (apparent size) preserved.
- **428 tests / 53 files**, lint, build, `git diff --check` — green.

## Night Shift full-chapter screenshot QA — begin/mid/end × 3 viewports (2026-07-12) ✅

Meticulous pixel pass over the four pinned chapters using a scratchpad
headless-Chrome rig (real wheel scrolling through Lenis, no preview hooks in
product code). Captured and inspected begin/mid/end of Books, Chases and
Collects plus Answers at 1440×900, 1024×768 and 390×844.

### Corrections from the screenshots
- **Books:** slots now reveal by OPACITY at final size (no more random-size
  card jumble mid-assembly); grid nudged onto the box's visual centre; BOOK
  camera pulled back slightly so the grid clears the frame on 1024-wide
  screens too.
- **Chases:** scene now holds at full strength for the whole chapter (the old
  early fade at story 0.695 — a leftover from the flying camera — left an
  empty box while the copy was still active); engine dot visibly brighter;
  dim→caught crossfade cleaned.
- **Collects:** tail fade moved from d=0.86 to d=0.93 so the finished
  conversation stays readable while its copy is active, still fully gone by
  story end.
- **Mobile (390×844):** all three fixed-camera scenes re-framed for the
  portrait viewport window (they had inherited desktop offsets and clipped
  hard left/right); every card verified inside the box across chapters.
- **Copy rail:** both desktop and mobile rails are now clipped, masked
  windows — ghost chapters fade at the window edges instead of piling onto
  the navbar (1024) or bleeding over the animation box (mobile).

### Verification
- 20+ screenshots captured and visually inspected across the three viewports,
  re-shot after every adjustment; QA rig lives outside the repo (scratchpad).
- `npm run lint`, `npm run build`, `git diff --check` — green.
- **424 tests / 52 files** — green (camera keyframe test updated for the
  BOOK pullback).

## Night Shift frame alignment + screenshot QA (2026-07-12) ✅

Corrected the remaining perspective and overflow issues using forced chapter
captures from the real rendered landing page.

### Done
- **Books:** calendar cards now copy the camera quaternion, remain perfectly
  screen-straight and fit as a centred grid inside the animation box.
- **Chases:** returned to the clearer left-side engine dot with eight readable
  follow-up cards arranged in two columns to its right; every card and line is
  contained by the frame.
- **Collects:** payment messages now use fixed lanes and screen-aligned
  quaternions so the entire thread is straight, centred and fully contained.
- Retuned the three fixed camera targets without reintroducing any chapter
  zoom, travel or roll.

### Verification
- Captured and visually inspected forced Books, Chases and Collects renders at
  1440 × 900 before removing the temporary preview hook.
- `npm run lint` — green.
- `npm run build` — green.
- **424 tests / 52 files** — green under Node 22.

## Night Shift fixed-stage compositions (2026-07-12) ✅

Finalised the four browser-box scenes based on founder review of real scroll
captures.

### Done
- Restored **Answers** to the exact preferred corridor behaviour: original
  message distribution, camera flight, proximity scaling, bob and gentle bank.
- **Books** now snaps to one fixed camera and never moves during the chapter.
  Calendar slots occupy a larger flat grid, reveal in place on scroll and the
  7:30 slot turns green; no scatter flight, perspective tilt or zoom.
- **Chases** now snaps to a fixed closer camera. Eight readable follow-ups sit
  around a solid central green engine dot, with pursuit lines radiating from
  the centre and the existing `follow-up sent ✓` state.
- **Collects** now snaps to a fixed closer camera with larger, aligned messages
  that rise sequentially; no chapter camera movement or inherited roll.
- The showcase is now a plain bordered animation box. Removed traffic lights,
  fake URL/prompt bar, route text, chapter counter, status badges, LIVE badge,
  progress strip and green offset shadow.
- Camera changes into Books/Chases/Collects are immediate scene cuts; only the
  restored Answers chapter retains cinematic camera motion.

### Verification
- `npm run lint` — green.
- `npm run build` — green.
- **424 tests / 52 files** — green under Node 22.

## Night Shift viewport correction + features simplification (2026-07-11) ✅

Corrected the split-screen scenes after real-browser review exposed framing
that had been inherited from the old full-screen camera flight.

### Done
- **Answers:** replaced the fly-through corridor with one straight-on thread;
  six messages rise into fixed rows sequentially and stay centred.
- **Books:** removed card shear, Y tilt, rotation and forward arc; the calendar
  now assembles on one flat plane under a held, wider camera.
- **Chases:** widened the camera, reduced chip size, removed idle drift/pop and
  kept the useful green pursuit lines + `follow-up sent ✓` state.
- **Collects:** moved the camera back, reduced message size, removed Y rotation
  and bobbing; payment messages now arrive one by one in a straight stack.
- Rebuilt the left copy motion as one translated rail with 320px slots. Older
  chapters retain their own positions instead of stacking at one exit point.
- Removed the fixed page-wide `Shift` clock. Progress now exists only inside
  the four-chapter browser where it is meaningful; Features, Comparison and
  other daylight sections no longer carry a night-shift ornament.
- Replaced the decorative eight-tile feature collage with two direct blocks:
  **the job** (answer/book/chase/collect) and **the desk behind it** (inbox,
  leads, compliant outbound and measurement). Removed miniature fake-product
  visuals and generic SaaS bento treatment.

### Verification
- `npm run lint` — green.
- `npm run build` — green.
- **423 tests / 52 files** — green under Node 22.

## Night Shift split-screen showcase (2026-07-11) ✅

Reframed the four top scroll chapters to match a pinned services/showcase
interaction: narrative on the left, one persistent product browser on the
right.

### Done
- The left rail now advances vertically through **answers → books → chases →
  collects**. The active chapter settles at full contrast while the previous
  and next chapters move above/below at low opacity.
- The existing WebGL scenes remain scroll-synced, but desktop and mobile masks
  expose them through a bordered browser viewport instead of across the whole
  page during the Night Shift.
- Browser chrome updates with each chapter: product route, `01 / 04` chapter
  count, action status and one continuous progress line.
- Desktop uses the requested side-by-side pinned composition. Narrow screens
  stack the active copy above a shorter browser viewport while preserving the
  same four-part scrub.
- No screenshots or third-party website embeds: all visuals remain native,
  deterministic Nudge product scenes with the existing quality governor and
  reduced-motion/static fallbacks.

### Verification
- `npm run lint` — green.
- `npm run build` — green.
- **423 tests / 52 files** — green under Node 22.

## Landing white-world art direction (2026-07-11) ✅

Reworked the Night Shift landing after moving its canvas from dark to white,
without replacing the scroll/WebGL animation system.

### Done
- Restored the core hero idea as **“Your front desk sleeps. This one
  doesn’t.”** and rebuilt the opening as a bold split composition with a live
  overnight shift ledger instead of copy floating alone on white.
- Kept the world background genuinely white while restoring scene definition
  through darker emerald particles, stronger calendar/bubble borders, richer
  caught-lead and payment states, and more visible horizon light.
- Expanded the chase and collect scenes into readable, deterministic customer
  stories; retained responsive scene offsets, adaptive quality, scroll sync,
  reduced-motion behavior and static copy fallbacks.
- Removed the repeated numbered-header + italic-serif treatment from the
  daylight sections. Replaced generic SaaS card styling with a single dark
  flagship block, ruled supporting tools, stronger sans typography, direct
  headlines, white section surfaces and hard-edged green/ink accents.
- Refined the morning payoff, salary math, comparison, industries, reseller
  and closing CTA so the page reads like one sales argument rather than a set
  of interchangeable AI-generated sections.

### Verification
- Desktop and narrow-viewport screenshots checked with local headless Chrome.
- `npm run lint` — green.
- `npm run build` — green.
- **423 tests / 52 files** — green under Node 22. The machine default is Node
  20.14; Vite 7 requires Node 20.19+ before `npm test` can start normally.

## Agent Knowledge Memory — "the employee that trains itself" (2026-07-10) ✅

Branch `feat/agent-knowledge` (spec:
`docs/superpowers/specs/2026-07-10-agent-knowledge-memory-design.md`). The
agent's knowledge is now structured, categorized, conditional, and
self-growing — no fine-tuning (Meta policy + Haiku economics), all prompt
grounding.

### Done
- **Structured memory**: `KnowledgeEntry` (category / fact / optional
  condition, org-scoped + RLS). The prompt reads a categorized digest
  (`modules/knowledge/digest.ts`, capped, pure) — never the raw blob.
- **Time-aware conditions**: prompt carries `TODAY: <org-local weekday/time>`;
  "weekends only" facts answer correctly per day (verified live: asked for
  weekend-only kebabs on a Friday → agent said "today is Friday, weekends
  only").
- **Learn-on-the-job**: new `ask_owner` agent tool. Unknown in-scope question
  → "checking with the team" + deduped `OwnerQuestion` (10 phrasings = 1
  question via `questionKey`). Owner answers on **/knowledge** → Haiku
  distills to facts (keyless fallback: raw answer as one fact) → every
  waiting customer still inside the 24h window gets an automatic follow-up
  through `sendMessage`. Known-fact short-circuit stops the agent asking
  what it already knows.
- **Any-business identity**: prompt introduces the agent from the org's OWN
  vertical ("a jewellery business") — the silent restaurant fallback is dead.
- **/knowledge page**: answer queue + fact library (add/edit/archive,
  ADMIN-gated server-side) + one-click "structure my existing info" blob
  migration. Sidebar entry, dashboard nudge banner, audit-log actions.
- **Questionnaire** (`/knowledge/questionnaire`): one deterministic
  20-question script (per-vertical wording), two modes — premade form and
  chat-style interview — both distilling into the same memory. New
  "Teach your AI the business" onboarding-checklist step (now 6 steps);
  concierge counts structured knowledge as a configured KB.
- **Inbox suggest-reply** reads the same digest.
- Demo seed: 10 categorized facts (2 conditional) + 1 pending owner question.
- **E2E verified live** (`scripts/knowledge-live.ts`, real code paths, Haiku,
  simulation sends): ask-unknown → queue → answer → distill → auto follow-up
  → re-ask answered from memory with the condition applied. Cleans up after
  itself.
- **422 tests / 52 files** (was 372/45); tsc, lint, build green.

### Decisions
- No embeddings/RAG — an SMB's 50–500 facts fit Haiku's context; the digest
  is deterministic and testable. Revisit if a client passes ~1,000 facts.
- Prompt hardened against closed-world reading: "business information may be
  INCOMPLETE — absence ≠ no; ask_owner instead of denying" (the E2E caught
  the agent saying "we don't have kebabs" before this rule).

### Known limitations
- Haiku can still name invented alternatives when being helpful (observed:
  fictional dishes offered alongside a correct answer). Mitigations: the
  never-invent/verbatim rules, the `not_offered` questionnaire item, and the
  fact base growing with real traffic. Watch in production transcripts.
- Follow-ups outside the 24h window are memory-only (template re-open is a
  documented v2).
- Owner is asked in-app only (WhatsApp-to-owner is v2).

### Founder TODO
- Production: `npm run db:push` + `npm run db:rls` (two new tables) before
  deploying this branch; then merge to main.

## Landing v2 — "The Night Shift" (2026-07-06) ✅

The landing page rebuilt as an immersive 3D scroll experience on branch
`landing-v2` (spec: `docs/superpowers/specs/2026-07-06-landing-3d-design.md`):

- **One persistent R3F world** behind the whole page — sky grades night → dawn
  → morning (`world/palette.ts`), a keyframed camera path (`world/path.ts`),
  and three chapter scenes: chat-bubble flythrough, calendar assembly, lead
  orbit. Scroll is time: 11:47 PM → 9:00 AM on the DayRail shift clock.
- **Pinned chapter story** (`chapters/night-shift.tsx`) synced to the same
  `CHAPTERS` spans the 3D scenes use; morning payoff with counters; daylight
  sections full-bleed (features → salary → compare → industries → reseller);
  pricing and FAQ live on their own routes (`/pricing`, `/faq`).
- **Adaptive quality on desktop AND mobile**: device tiering + live frame
  governor (`world/quality.ts`, tested), dpr/particle step-down, no drei.
- **Fallbacks structural**: no-JS / reduced-motion / no-WebGL get the complete
  static story on the `.v2-page` night→day gradient; all copy is server HTML.
- Deleted dead v1 landing components (hero, social-proof, agent-conversation)
  and the superseded `nightfield.tsx`; pricing-tiers/roi-calculator stay (used
  by the Pricing section).
- New unit tests: progress spine, quality tiers, sky palette, camera path
  (372 total green). Build + lint green throughout.

## Course correction — AI Front Desk (2026-07-05) ✅

Strategic pivot from "WhatsApp CRM" to **AI Front Desk** (see `docs/STRATEGY.md`),
executed as an 8-phase branch chain. Highlights:

- **Restructure** (`phase-2-structure`): root `app/lib/components` → `src/` with
  `src/modules/*` domain modules, `src/lib` cross-cutting only; `@/*`→`src/*`.
  `docs/ARCHITECTURE.md`. Pure moves, green at every commit.
- **Hardening** (`phase-4-hardening`): fixed H1 (agent-profile role gate) + M1
  (stats scoping) + a 23-agent adversarial security re-audit's findings — HIGH
  billing payment-integrity (plan bound to the paid order, not client input),
  SSRF guard on outbound webhooks, open-redirect guards, whatsapp template-status
  tenant isolation, campaign-edit + export + integrations role gates, timing-safe
  compares, x-real-ip rate-limit keying. +23 regression tests. `docs/SECURITY.md`.
- **Purge** (`phase-3-purge`): depcheck/ts-prune-verified dead-code removal;
  `docs/CHANGELOG_CLEANUP.md`.
- **The moat** (`phase-5-product`): Google Calendar booking (sim|live driver
  split, `src/modules/calendar`), the Revenue-Recovery follow-up engine
  (`src/modules/followup`: reminders/no-show/review + quiet-lead nudge, all
  consent+template gated), concierge onboarding (`src/modules/concierge`), and
  the **AI Front Desk flagship tier** (₹14,999) + MYR + the `checkAiFrontDesk`
  gate. Everything demoable in `SEND_MODE=simulation`.
- **Landing** (`phase-6-landing`): rebuilt around the AI-employee USP — animated
  agent conversation, Meta-vs-Nudge comparison, salary calculator, reseller CTA,
  flagship-first pricing. Dep-free (no 3D lib), reduced-motion-safe.
- **Docs** (`phase-7-docs`): `AGENTS.md`/`CLAUDE.md` carry the strategy + 7
  invariants + architecture rules; `docs/STRATEGY.md`, README, DEMO_SCRIPT,
  DEPLOYMENT refreshed.

**Founder TODO after this branch:** `npm run db:push` + `npm run db:rls` (new
tables: CalendarAccount, FollowUpConfig + BookingRequest fields), then the ordered
list in `docs/HANDOVER.md` — Meta setup, deploy, legal placeholders, then SELL.

---

## Phase 10 — Global markets (2026-07-04) ✅

Two commits: multi-currency core + landing currency toggle. Verified in both
currencies against the running app (screenshots, 280 tests, tsc/lint/build).

### Done
- **Org globalization columns**: `currency` (INR/USD/AED/SAR/SGD/IDR/BRL/
  MXN/GBP — every market bills in its LOCAL currency), `dialCode`, `timezone`
  — one country pick at onboarding (or Settings → General) sets all three.
  India defaults preserved for all existing rows/call sites.
- **Dual-gateway billing**: every non-INR org → hosted Stripe Checkout in
  its local currency (REST, env-gated `STRIPE_SECRET_KEY`; signed webhook
  `/api/webhooks/stripe` with replay tolerance is source of truth); INR stays
  Razorpay. PLAN_PRICES carries rounded market prices per plan per currency
  (e.g. Growth: ₹2,499 / $69 / AED 249 / SAR 259 / S$95 / Rp 1.099.000 /
  R$349 / MX$1,299 / £59) — founder-tunable, deliberately not live FX.
  Per-currency message-rate estimates likewise (live Meta pricing overrides).
  Verified visually: AED, BRL, IDR and ₹ billing pages all render correctly.
- **Per-market money everywhere**: message-rate defaults per currency
  (₹0.99 / $0.03, live Meta prices still override per message), estimates,
  simulated cost accrual, monthly usage, campaign stats/recipients/tables,
  analytics spend, dashboard revenue — all in org currency.
- **Country-aware phones**: bare local numbers get the org dial code;
  Meta-webhook numbers treated as cc-included; sim tester pre-normalizes.
- **Market AI voice**: `+91` keeps the Hinglish-friendly campaign voice;
  everyone else gets clear international English. Org-timezone greeting.
- **Landing**: ₹ India / $ International toggle over the pricing grid + ROI
  calculator (prices imported from lib/billing/plans — no drift).
- Tests: +16 (country-aware phones, currency formatting, USD plan ladder,
  Stripe webhook HMAC + replay defense) → **280 total**.

### Known limitations
- Switching country after accruing message costs re-labels historical minor
  units under the new symbol (no FX conversion) — country is meant to be a
  set-once onboarding choice.
- USD message-rate default ($0.03) is a placeholder average; Meta rates vary
  by destination country. Live-mode webhook pricing overrides per message.
- Landing toggle defaults to ₹; no geo-IP detection yet.

---

## Phase 9 — Demo-ready + production hardening + mobile (2026-07-03) ✅

Eight commits (070d62a…c445c9b) taking the MVP to client-demo-ready.

### Done
- **Plan limits enforced server-side** (contacts, team seats, automations,
  campaign messages/month — single choke point in enqueueCampaign) with
  friendly upgrade prompts; tiers renamed Free/Starter/Growth/Pro with
  message quotas (legacy "scale" id maps forward).
- **Rate limiting** (in-process sliding window, honest best-effort scope):
  public waitlist per IP, AI suggest per org, webhook/Meta test pings per
  org. **Optional CRON_SECRET** bearer auth on /api/cron.
- **Audit log**: append-only AuditLog + admin viewer (Settings → Audit log),
  wired into role changes, invites, opt-outs, contact deletes, campaign
  sends, WhatsApp connection, API keys, webhooks, plan changes, demo resets.
- **Demo reset** (Settings → Data; simulation + OWNER only): seed extracted
  to lib/demo/seed.ts (CLI wrapper kept), wipes CRM data, keeps
  team/keys/webhooks/billing, re-seeds; verified end to end.
- **Go-live checklist** on Settings → WhatsApp: six real-state checks.
- **Retry failed campaign sends** (fresh Message rows so the deterministic
  sim timeline can't re-fail them; consent re-checked).
- **Landing sellability**: real pricing tiers, ROI calculator with disclosed
  assumptions, six industry use cases, Start free / Book a demo CTA flow,
  login restyle. Fixed a real production bug: reduced-motion users saw
  NOTHING animated (SSR opacity-0 hydration mismatch in Reveal/Stagger).
- **Mobile version**: bottom nav (<lg), Modal→bottom sheet + full-width
  Drawer <sm, DataTable card mode <sm, inbox as a true mobile chat,
  grid-cols-1 base fix across ~17 files. 22 routes × {375,390,430,768} —
  zero page-level horizontal overflow (automated sweep). docs/MOBILE_QA.md.
- **Docs pack**: README rewrite + DEPLOYMENT.md + SECURITY.md +
  DEMO_SCRIPT.md (5-minute sales flow) + GO_LIVE aligned to per-org creds.
- Composite indexes (Conversation [orgId,lastMessageAt], Contact
  [orgId,createdAt]); WhatsApp connect ADMIN-gated.
- **264 unit tests** (28 files; +31: CSV/CWE-1236, rate limit, plan limits,
  Razorpay HMAC), tsc/lint/build green.

### Known gaps
- Rate limiting is per-instance (serverless) — documented in SECURITY.md.
- Plan limits are read-then-write (tiny race overshoot acceptable).
- Automation builder is functional-but-dense at 375px.
- Live WhatsApp path still awaits real Meta credentials (runbook ready).

---

## Phase 8 — Full CRM MVP (2026-07-02) ✅ BUILT (AiSensy/WATI-class product)

### Done
Two commits (`aea838c` foundation, `0635833` modules), built per
`docs/MVP_BUILD_SPEC.md` (the build contract — read it first).

- **Foundation**: additive Prisma schema (Membership + OWNER/ADMIN/AGENT
  roles, Invite w/ auto-join on signup, Tag/ContactTag/ConversationTag, Note,
  lead stages, conversation assignment/unread/preview, org-scoped library
  Templates (campaignId now optional), Automation/Step/Run, ApiKey, Org
  settings Json); `requireOrgContext()`/`requireRole()` alongside unchanged
  `requireOrg()`; `npm run db:rls` (idempotent RLS enabler, run after every
  db:push); 21-piece UI kit in `components/ui/`; dark-sidebar app shell
  `app/(app)/` — existing URLs unchanged; rich idempotent demo seed.
- **Modules**: dashboard w/ onboarding wizard + checklist + stat cards;
  shared inbox `/inbox` (3-pane, filters, 24h-window-gated composer,
  template sender, AI suggest-reply w/ tones — drafts only, never auto-sent,
  canned samples without API key; tags/notes/assignee/stage; 3s polling that
  pauses on hidden tab; sim tester); contacts CRM (filterable table, profile
  w/ merged activity timeline, bulk actions, tags manager, dynamic segments);
  campaign wizard (photo/template/blank → audience or segment → compliance
  interstitial → send now or schedule); template library w/ mock Meta review
  (name containing "reject" → rejection path, for demos); automations engine
  (5 triggers, 8 step kinds, wait/resume via cron, run logs, wired into the
  inbound path BEFORE the AI agent — automation reply suppresses AI reply);
  analytics (volume/rates/campaign/agent/funnel/tags, recharts); settings
  (general/team+invites/notifications/billing placeholder/CSV export) +
  integrations (webhook info, test connection, hashed API keys).
- `/conversations` now redirects to `/inbox`. Cron tick = release scheduled
  campaigns + resume waiting automation runs + advance send queues.
- **226 unit tests** (was 72), tsc/lint/build green on Node 20.

### Decisions
- Consent gate untouched at the core (`sendMessage`); automations/template
  sends inherit it — blockedByConsent fails the step, logged.
- Roles UI-hidden AND server-enforced (`requireRole`); last-OWNER demotion
  blocked server-side.
- Live Meta template submission for library templates is a documented stub
  ("ships with WABA onboarding"); campaign-template live path unchanged.
- `.env.local` on this machine now points at local Postgres
  (`dhairyakakkar@localhost`) with the seeded demo org; real creds live in
  Vercel. Supabase auth keys locally are placeholders — signed-in flows need
  real keys or the production URL.

### Known gaps / next
- Local runtime verification limited to public pages + auth redirects
  (placeholder Supabase keys); full click-through needs real creds.
- Invite emails not sent (auto-join on signup by email match instead).
- Payments, Zapier/Make, message-history export: placeholder cards.
- Production deploy of this build not yet run (`npx vercel --prod`), and
  `npm run db:push` + `db:rls` + seed must be run against Supabase first.

---

## Phase 5 — Polish, demo, deploy (2026-06-13) ✅ DEPLOYED

### Done
- **Live URL: https://nudge-reach.vercel.app** (project `nudge-reach`,
  Vercel account `custedlol`; simulation mode).
- All 12 env vars pushed to Vercel production; `vercel.json` daily cron on
  `/api/cron/process-queue` (dashboard view-ticking covers demo-scale
  sends); `maxDuration: 60` on the generation route segment.
- Demo retailer seed (`scripts/seed-demo.ts`): 5 opted-in contacts,
  "Regular customers (demo)" audience, draft "Banarasi Silk Dupatta"
  campaign — deterministic, re-runnable, no AI call.
- README: deploy + demo-seed docs, live URL.
- 61 unit tests passing; verified against production with a signed-in
  user: dashboard, campaigns list (demo + sent campaign), contacts.

### Post-deploy hotfix (2026-06-13)
- **Photo upload 500'd in production**: Next.js server actions default to a
  1 MB body cap; product photos exceed it. Raised to 6 MB via
  `experimental.serverActions.bodySizeLimit`, plus a friendly client-side
  4 MB pre-check on `/campaigns/new`.
- **White text in input boxes**: the create-next-app scaffold shipped
  `prefers-color-scheme: dark` variables, so dark-mode browsers rendered
  white form text on our white cards. Removed the dark block, set
  `color-scheme: light`, and pinned explicit input/textarea/select colors.
- Redeployed; both fixes verified live (page loads, `color-scheme:light`
  present in shipped CSS, no new runtime errors).

### Founder action still needed (1 minute)
- Supabase → Authentication → URL Configuration: set Site URL to
  https://nudge-reach.vercel.app and add it to Redirect URLs, so NEW
  sign-ups from production get confirmation links that redirect correctly
  (currently they'd bounce to localhost).

### Known limitations / deferred
- Live WhatsApp path (real WABA creds) is code-complete but unverified —
  no Meta Business Account yet. Embedded Signup not built (manual creds
  screen exists at /settings/whatsapp).
- Cost estimator uses the configurable INR rate (₹0.99 default) — verify
  against Meta's current pricing before going live.
- Local `next dev` OOMs on this machine after long idle; use
  `npm run build && npx next start` locally instead.

### MVP definition of done — status
- [x] Sign in → upload product photo → generated compliant campaign
- [x] Edit campaign → WhatsApp-style preview
- [x] Import opted-in contacts → audiences
- [x] Run campaign (simulated) → delivery/read/click stats + estimated cost
- [x] Deployed and reachable on a URL

---

## Phase 4 — Send & track (2026-06-12) ✅ COMPLETE (simulation verified end to end; live driver code-complete, unverified — no Meta credentials)

### Done
- **Models**: `Message` (status QUEUED→SENT→DELIVERED→READ→CLICKED /
  FAILED, metaMessageId, costMinorUnits; unique per campaign+contact),
  `WebhookEvent` (raw payload audit/idempotency), `Campaign.audienceId`.
  RLS enabled.
- **Send queue** (`lib/send/queue.ts`) — Postgres-backed (decision: no
  Inngest account dependency; swappable later). `enqueueCampaign` is
  consent-gated fan-out (rule 2 — non-opted-in members counted + skipped);
  `processQueue` sends batches of 30 through `lib/messaging` (which
  re-checks consent per message), paced ~10/s in live mode; campaign
  auto-completes to SENT when the queue drains.
- **Simulated delivery lifecycle** (`lib/send/sim-progress.ts`, pure +
  unit-tested): deterministic per-message timeline (~93% deliver, 75% read,
  30% click, rest fail), forward-only transitions; cost accrued per
  delivered message at the configured INR rate.
- **Webhook endpoint** (`/api/webhooks/whatsapp`) — GET subscription
  handshake; POST verifies `X-Hub-Signature-256` (timing-safe, unit-tested),
  stores raw event, then idempotently applies: message status updates
  (incl. pricing → actual cost), template APPROVED/REJECTED updates,
  inbound STOP/unsubscribe/opt-out → permanent opt-out scoped to the org's
  phone number. Proxy excludes `/api/webhooks` + `/api/cron` from auth.
- **Queue tick** (`/api/cron/process-queue`) for Vercel Cron; the dashboard
  also ticks server-side on every view so small sends need no cron.
- **UI**: run panel on approved campaigns (audience picker with opted-in
  counts, estimate = recipients × rate, simulation notice); live-updating
  stats dashboard (progress bar, sent/delivered/read/clicked/failed cards,
  estimated vs actual cost), auto-refresh while sending.
- 61 unit tests passing; build + lint green.

### Verified live (scripts/phase4-live.ts + curl)
- 10-person audience (9 opted in, 1 not): consent gate queued 9, skipped 1.
- 9 sends via the simulation driver; statuses progressed over ~30s
  (9 delivered → 5 read → 1 clicked), cost ₹8.91, campaign → SENT;
  dashboard page renders the results.
- Webhook: handshake echoes challenge (bad token → 403); signed STOP
  message permanently opted out the contact; tampered signature → 401;
  event stored with processedAt.

### Decisions
- Postgres queue + on-view/cron ticking instead of Inngest (zero extra
  accounts/keys; the founder can swap later — the queue API is 3 functions).
- Dev-server OOMs on this machine → verification runs against
  `next start` (production server).

### Next
- **Phase 5 — Polish, demo, deploy**: demo seed, Vercel deploy + cron,
  README. Needs founder's Vercel login for the deploy itself.

---

## Phase 3 — Templates & approval (2026-06-12) ✅ COMPLETE (simulation verified; live path code-complete, unverified — no Meta credentials yet)

### Done
- **Template payload builder** (`lib/whatsapp/template.ts`) — campaign
  content → Meta `message_templates` create payload; unit-tested against the
  reference example in docs/WHATSAPP_CLOUD_API.md. `category` forced
  MARKETING. Meta-safe template names via `slugifyTemplateName`.
- **Models**: `Template` (componentsJson, metaStatus PENDING/APPROVED/
  REJECTED, rejectionReason), `WhatsappAccount` (one per org,
  `accessTokenEncrypted`). RLS enabled.
- **Token encryption** (`lib/crypto.ts`) — AES-256-GCM with
  TOKEN_ENCRYPTION_KEY; round-trip + tamper tests.
- **Approval flow** (`lib/whatsapp/approval.ts`) — submit: simulation
  creates the PENDING row with a mock media handle; live POSTs to
  `/<WABA_ID>/message_templates` incl. resumable-upload of the header image.
  Status: polling fallback (`refreshTemplateStatus`); simulation approves
  after a 10s mock review; rejection sets campaign back to DRAFT with the
  reason shown + edit-and-resubmit. Webhook delivery of status arrives with
  the Phase 4 webhook endpoint.
- **UI**: approval panel on the campaign page (submit → live-updating
  pending banner (auto-refresh every 4s) → approved/rejected states);
  `/settings/whatsapp` connection screen (manual WABA/phone/token entry,
  token encrypted; simulation-mode banner). Editing an approved campaign
  resets it to DRAFT — stale approvals can't be sent.
- 49 unit tests passing; build + lint green.

### Verified live (scripts/phase3-live.ts)
- Real flow in simulation: submit → Template row with HEADER/BODY/FOOTER/
  BUTTONS payload → TEMPLATE_PENDING → (11s) → APPROVED →
  campaign TEMPLATE_APPROVED → page renders "Approved — ready to send".

### Decisions
- Meta allows one header per template: with a product photo we use an IMAGE
  header and fold the text headline into the body as a *bold* first line;
  TEXT header otherwise.
- Mock review window: 10 seconds (long enough to demo the pending state).
- One WhatsApp account per org (MVP).

### Next
- **Phase 4 — Send & track**: Message model, consent-gated rate-limited
  send queue, webhook endpoint (signatures, idempotency, STOP → opt-out),
  campaign dashboard with delivery stats + cost.

---

## Phase 2 — Generate, the wedge (2026-06-12) ✅ COMPLETE

### Done
- **Storage**: `product-photos` public bucket (public read is required —
  Meta fetches template header images by URL); authenticated upload/update
  policies via SQL.
- **Models**: `Product`, `Campaign` (status enum per PRD; editable fields
  stored as `content Json` in the §7 shape — Template rows arrive in
  Phase 3). RLS enabled.
- **Generation** (`lib/campaign/`): PRD §7 system prompt verbatim + explicit
  JSON key list; vision path when a photo exists; defensive parsing
  (`extractJson` strips fences/prose) with one strict retry; **guardrails as
  pure unit-tested functions** — `repairPersonalization` ({{1}} exactly
  once), `repairOptOutFooter` (opt-out mandatory, ≤60 chars),
  `repairAndValidate` (zod, Meta length caps, ≤3 buttons).
- **UI**: `/campaigns` list with status badges + empty state,
  `/campaigns/new` (photo upload with thumbnail + optional description),
  `/campaigns/[id]` editor — every field editable with a live generic
  chat-style preview (`components/whatsapp-preview.tsx`, no WhatsApp
  branding), AI tips panel (imageTreatment/notes). Human edits pass through
  the same compliance repairs — the opt-out and {{1}} can't be edited away.
- 40 unit tests passing; build + lint green.

### Verified live (scripts/phase2-live.ts + fetch-as-user.js)
- Real product photo → Haiku vision → valid compliant JSON through the real
  `lib/campaign/generate.ts` path (model demonstrably *saw* the image — its
  photo tip referenced the hanger in the test shot).
- Campaign persisted; `/campaigns/[id]` renders header, body with {{1}}
  substituted ("Hi Priya, …"), opt-out footer, and both buttons; list +
  new pages render.

### Decisions
- Editable campaign fields live on `Campaign.content` (Json, §7 shape)
  rather than a Template row — Template (Meta payload + approval status)
  is a Phase 3 concern built *from* this content.
- Image cap 4 MB before upload (Claude vision limit ~5 MB).
- Preview is deliberately generic chat styling (no Meta/WhatsApp logo).
- Visual (screenshot) check of the preview deferred to the Phase 5 demo
  pass; Phase 2 verified via rendered-HTML assertions.

### Next
- **Phase 3 — Templates & approval**: Meta MARKETING template payload
  builder (unit-tested vs docs example), submit + mock/live approval
  tracking, WhatsApp connection screen (manual creds, token encrypted).

---

## Phase 1 — Platform modules (2026-06-12) ✅ COMPLETE

### Done
- **`lib/model-router`** — `generate({system, prompt, image?, maxTokens})` via
  the official `@anthropic-ai/sdk`. Default model `claude-haiku-4-5`
  (cheapest vision-capable tier, $1/$5 per MTok — verified via the claude-api
  skill), env-configurable. **Rule 3 enforced in code:**
  `assertRuntimeModelAllowed` throws on opus/fable/mythos (unit-tested).
- **`lib/consent`** — pure `canSendMarketing(contact)`; opt-out permanent.
  Unit-tested (rule 2).
- **`lib/messaging`** — channel-agnostic `sendMessage(channel, recipient,
  payload)`; WhatsApp simulation + live (Cloud API) drivers behind one
  interface; consent gate enforced at this lowest layer for MARKETING
  payloads. `buildSendPayload` unit-tested against the docs example.
- **`lib/billing`** — stub: `estimateCampaignCost` (recipients × INR rate,
  labelled estimate), `formatInr`, ledger interface for live reconciliation.
- **Contacts/Audiences** — Prisma models (Contact unique per org+phone,
  Audience, AudienceContact), RLS enabled on all three; `/contacts` page with
  add-one, CSV-paste import (requires explicit consent confirmation —
  compliance checklist), opt-out / delete, audience create/delete.
  `normalizePhoneE164` helper (+91 default) unit-tested.
- 24 unit tests passing; build + lint green; CRUD verified end to end against
  the live app + DB (`scripts/verify-phase1.js`).

### Decisions
- Consent gate enforced **twice**: pure function for queue/UI checks + inside
  `lib/messaging.sendMessage` so no send path can bypass it.
- Runtime model uses the bare alias `claude-haiku-4-5` (canonical per
  current Anthropic docs; no date suffix).
- CSV import never resurrects an opted-out contact (upsert updates name only).
- Audience membership limited to opted-in contacts at the UI level; the send
  path re-checks the gate anyway.

### Acceptance criteria status
- [x] `canSendMarketing` unit-tested
- [x] Contacts/audiences CRUD works (verified live)
- [x] Model-router returns text for a test prompt — verified live with the
      founder's key (`scripts/verify-model-router.js`, claude-haiku-4-5,
      37 in / 33 out tokens).

### Next
- **Phase 2 — Generate (the wedge):** photo upload to Supabase Storage,
  campaign generation per PRD §7, editable fields + WhatsApp-style preview.

---

## Phase 0 — Scaffold (2026-06-12) ✅ COMPLETE — verified against live Supabase

### Done
- Git repo initialized; project docs moved from repo root into `docs/`.
- Next.js 16 (App Router) + TypeScript + Tailwind v4 scaffolded.
- Prisma 6 initialized against Supabase Postgres (`prisma/schema.prisma`) with
  the `Org` model (one org per user). `lib/db.ts` Prisma singleton,
  `lib/org.ts` find-or-create org (race-safe).
- `.env.example` with every variable through Phase 4; `lib/env.ts` validates
  env at boot with Zod (imported from `app/layout.tsx`).
- Supabase Auth wired with `@supabase/ssr`: browser/server clients in
  `lib/supabase/`, session refresh in `proxy.ts` (Next 16's renamed
  middleware), email+password and Google OAuth on `/login`, callback/confirm/
  signout routes under `/auth/*`.
- Protected `/dashboard` page: verifies auth with `getClaims()`, creates the
  Org row on first visit, renders "Hello, {org}" — the auth + DB round-trip.
- Vitest set up; first tests cover the env schema (`tests/env.test.ts`).
- `README.md` with setup instructions.

### Decisions (smallest reversible choice where docs were silent)
- **Docs location:** moved `PRD.md`/`BUILD_PLAN.md`/`WHATSAPP_CLOUD_API.md`
  into `docs/` to match the kickoff prompt's expected layout.
- **Auth method:** email+password as primary (works with zero email/SMTP
  config) + Google OAuth button; magic-link can be added later. Both the
  PKCE `/auth/callback` and token-hash `/auth/confirm` routes exist so
  sign-up works regardless of the project's email-confirmation setting.
- **Next 16 conventions:** `proxy.ts` (middleware was renamed in v16);
  Supabase's current guidance followed — publishable key (not legacy anon),
  `getClaims()` for page protection (never `getSession()` server-side).
- **Env validation & live mode:** `SEND_MODE=live` requires all `WHATSAPP_*`
  vars + `TOKEN_ENCRYPTION_KEY` at boot (enforced in `lib/env.ts`, unit
  tested). Validation is skipped during `next build` so CI needs no secrets.
- **Default runtime model:** `claude-haiku-4-5-20251001` (cheapest
  vision-capable Haiku tier) as `RUNTIME_MODEL` default; will be re-verified
  against current model list when building `lib/model-router` in Phase 1.
- **Prisma connections:** pooled `DATABASE_URL` (pgbouncer) for runtime +
  `DIRECT_URL` for migrations, per Supabase guidance.

### Acceptance criteria status
- [x] App builds
- [x] Env validated at boot; `.env.example` complete
- [x] `PROGRESS.md` + `README.md` created
- [x] User can sign in and an Org row is created — verified end to end
      against the live Supabase project (`lgojsxrljjmkwxawocdk`,
      ap-southeast-1) with test account `visheshjain1705+nudgetest@gmail.com`
      via `scripts/verify-phase0.js`

### Post-verification decisions
- **RLS enabled on `Org`** (and required on every future Prisma table):
  Supabase's Data API exposes `public` tables to the publishable key by
  default; RLS with no policies blocks that while Prisma (table owner)
  retains access.
- **`.env` + `.env.local` split:** Prisma CLI only reads `.env`, Next.js
  reads both — DB URLs live in `.env`, everything in `.env.local`. Both
  git-ignored.
- **Supabase MCP connector abandoned** for now (their OAuth client_id is
  broken); using direct connection strings instead.
- **Google OAuth provider not yet enabled** in the Supabase project — the
  login button exists but the founder must enable the provider in
  Supabase → Authentication → Providers (optional; email works).

### Next
- **Phase 1 — Platform modules**: model-router, channel-agnostic messaging
  interface, contacts/opt-in with consent gate (unit-tested), billing stub.
- Needs from founder: `ANTHROPIC_API_KEY` for the live model-router check.
