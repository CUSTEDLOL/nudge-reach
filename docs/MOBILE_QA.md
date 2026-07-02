# Mobile QA — authenticated app

Goal: a shop owner can run their whole WhatsApp operation from a phone.
Tested against the local production build (`npm run build && next start`) with
the seeded demo workspace ("Kanchan Boutique"), using Chrome DevTools-protocol
device emulation (`mobile: true`, touch enabled) at 375, 390, 430 and 768 px.

## Navigation model

- **< lg (mobile/tablet):** fixed bottom navigation bar
  (`components/app/bottom-nav.tsx`) with Dashboard, Inbox, Contacts, Campaigns
  and **More**. "More" opens a bottom sheet with the remaining sections
  (Templates, Automations, Analytics, Integrations, Settings — filtered by
  role), the simulation-mode chip, and the user block with sign-out.
  Safe-area padding (`pb-[env(safe-area-inset-bottom)]`), 44 px+ touch
  targets, active states per route.
- **lg+:** the dark sidebar, unchanged.
- The old topbar hamburger + slide-out sidebar drawer were **removed** (one
  nav system, no duplicates). The topbar keeps search + account menu and gains
  a brand mark on mobile.
- The bottom bar hides on `/inbox/[id]` — the thread is a full-screen chat and
  the composer owns the bottom edge (back arrow returns to the list).

## Routes tested × breakpoints

Automated horizontal-overflow sweep (`document.scrollWidth > clientWidth`)
plus eyeballed screenshots. ✓ = no page-level horizontal overflow, layout
verified usable.

| Route | 375 | 390 | 430 | 768 |
| --- | --- | --- | --- | --- |
| /dashboard | ✓ | ✓ | ✓ | ✓ |
| /inbox | ✓ | ✓ | ✓ | ✓ |
| /inbox/[id] (open + closed window) | ✓ | ✓ | ✓ | ✓ |
| /contacts | ✓ | ✓ | ✓ | ✓ |
| /contacts/[id] | ✓ | ✓ | ✓ | ✓ |
| /campaigns | ✓ | ✓ | ✓ | ✓ |
| /campaigns/new (steps 1–3) | ✓ | ✓ | ✓ | ✓ |
| /campaigns/[id] | ✓ | ✓ | ✓ | ✓ |
| /templates, /templates/new | ✓ | ✓ | ✓ | ✓ |
| /automations, /automations/new | ✓ | ✓ | ✓ | ✓ |
| /analytics | ✓ | ✓ | ✓ | ✓ |
| /integrations | ✓ | ✓ | ✓ | ✓ |
| /settings/* (all 8 sections) | ✓ | ✓ | ✓ | ✓ |
| /onboarding | ✓ | — | — | — |

Interactive states verified at 375: add-contact modal, CSV-import modal,
tags drawer, inbox details drawer (status/assignee/stage/tags/notes),
template-picker preview modal (closed 24 h window), sim-tester expanded,
"More" sheet, campaign wizard step 2 (audience) and step 3 (review + send).

## What changed, per area

### App shell (`components/app/`)
- `bottom-nav.tsx` (new): bottom bar + "More" bottom sheet.
- `shell.tsx`: renders BottomNav; reserves bottom padding on all routes except
  the thread; no more mobile-drawer state.
- `sidebar.tsx`: desktop-only now (mobile drawer removed).
- `topbar.tsx`: hamburger removed; mobile brand mark added.

### UI primitives (`components/ui/`)
- `modal.tsx`: below `sm` the dialog renders as a bottom sheet — full width,
  `rounded-t-2xl`, `max-h-[85dvh]`, grab handle, internally scrollable body,
  safe-area bottom padding. Centered dialog from `sm` up. Escape / backdrop /
  X close unchanged. All Modal/ConfirmDialog call sites inherit this.
- `drawer.tsx`: full-screen-width below `sm`; larger close target; safe-area
  padding.
- `data-table.tsx`: below `sm` rows render as stacked cards — first
  string-headed column is the title row, unlabeled columns (checkboxes,
  action menus) sit in the card header, remaining columns become label/value
  pairs derived from the column headers. Sort headers are replaced by a
  "Sort…" select on mobile. Search + pagination shared across both layouts;
  pagination buttons enlarged on mobile. No call-site changes required
  (contacts, campaigns, templates, recipients, runs all inherit).
- `tabs.tsx`: horizontal scroll instead of wrapping; `whitespace-nowrap`.
- `page-header.tsx`: action slot wraps instead of overflowing the viewport.
- `stat-card.tsx`: tighter mobile padding, icon hidden < sm, value `text-xl`
  on mobile, delta/hint row wraps.
- `button.tsx` / `input.tsx` / `select.tsx`: mobile-first sizing — h-10
  inputs/selects and md buttons (h-11 lg, h-9 sm) below `sm`, compact desktop
  sizes from `sm` up. Gives ~40 px+ touch targets app-wide for free.

### Inbox (flagship)
- List rows were already large; filter chips are now a horizontally
  scrollable row (no wrap), slightly bigger tap targets.
- List container height accounts for the bottom bar (`100dvh` calc).
- Thread: on mobile the status badge (Resolved/Pending/Needs human) hides so
  the contact name never collapses (status remains in the details drawer and
  the list); "Window closed" chip compacts to "Closed". Composer sticky at
  bottom, tone chips wrap, template sender + preview modal verified at 375.
- Context panel (drawer) is full-width on mobile; tags, notes, assignee,
  status and lead stage all verified usable.

### Tables & lists
- `automations-list.tsx`: raw 6-column table replaced on mobile by stacked
  cards (name, description, toggle, trigger/keyword chips, last run, runs
  link); table (now in an `overflow-x-auto` card) kept from `sm` up.
- Team settings: "Joined"/"Invited" columns hidden below `sm`, avatar hidden
  below `sm` so member + role fit without scrolling.

### Grids
- Every `grid … lg:grid-cols-*` / `sm:grid-cols-*` container got an explicit
  `grid-cols-1` base. Without it the implicit auto track sizes to content
  max-content and silently overflows the page (this was the root cause of
  page-level overflow on /dashboard, /analytics and /automations at 375).
- Dashboard + analytics stat rows are 2-up at 375 (`grid-cols-2`), billing
  usage cards 2-up, plan cards stack 1/2/4.

### Wizards & forms
- Campaign wizard: step indicator fits at 375 (inactive labels hidden below
  `sm`, shorter connectors); "Generate my campaign" full-width on mobile;
  review summary stacks; native file input no longer overflows its card;
  audience count box and footer wrap cleanly. Schedule datetime input is
  h-10 on mobile.
- Settings sub-nav: horizontally scrollable chip row below `lg` (bleeds to
  the screen edge), vertical list at `lg+`.
- Onboarding: verified at 375 (temporarily un-onboarding the demo org);
  "Skip for now" no longer wraps.

### Analytics
- Stat cards 2-up; recharts containers are width-responsive; campaign
  performance and agent tables scroll inside their own cards
  (`CardContent overflow-x-auto`), never the page.

## Known limitations (honest)

- **Wide tables scroll in-container from `sm` up** (analytics campaign table,
  team members at very narrow tablet widths). At `<sm` they are cards or
  trimmed columns; between 640–1024 some horizontal in-card scrolling remains
  by design.
- **Automation builder is functional-but-dense** at 375: single column and
  fully usable (verified), but a long automation means a lot of scrolling;
  no mobile-specific step reordering UI.
- **Contacts cards show all 9 fields** as label/value pairs (generic
  DataTable card mode) — informative but tall; 15 rows/page means long
  scrolls. Search/filters/sort mitigate.
- **DataTable mobile sort select** only covers sortable columns with string
  headers (all current call sites).
- The bottom "More" sheet and bottom bar don't show unread counts (no badge
  data is plumbed into the shell yet).
- Drag-to-dismiss on bottom sheets is not implemented — close is via
  backdrop, X, or Escape (as specified).
- Two "Festive Collection" draft campaigns were created in the demo seed by
  the wizard verification flow; use Settings → Data → Reset demo data to
  clean them up.

## No critical flow is desktop-only

Verified end-to-end on a 375 px viewport: sign-in shell → dashboard → add
contact / import CSV / manage tags → create campaign (photo, template, blank;
audience; review; send/schedule) → inbox reply (free-form + AI suggest +
template with preview when the window is closed) → conversation triage
(status, assignee, stage, tags, notes) → templates create/submit →
automations create/toggle → analytics → integrations → all settings →
onboarding.

## Verification results (final)

- `npx tsc --noEmit` — 0 errors
- `npm run lint` — clean
- `npm test` — 27 files, 264 tests passed
- `npm run build` — succeeds
- Overflow sweep: 22 routes × {375, 390, 430, 768} — no page-level
  horizontal overflow.
- Final screenshots: `scratchpad/mobile/*.png` (dashboard, inbox list, inbox
  thread, contacts, campaigns, wizard step 1, templates, analytics,
  settings/billing, automations, More sheet, inbox at 768).
