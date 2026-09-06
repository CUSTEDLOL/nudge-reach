# Adaptive Dashboard UX Design

**Date:** 2026-09-06

**Status:** Approved

## Objective

Replace Nudge's navigation-heavy dashboard with an adaptive operations workspace
that a clinic owner can understand immediately, while retaining the depth and
permissions required by larger teams. The product must feel like an AI employee
being supervised, not a collection of WhatsApp CRM tools.

The first screen must answer one question: **What needs my attention now?**

## Product principles

1. Lead with outcomes and exceptions, not feature inventory.
2. Keep the core navigation stable so personalization never destroys muscle
   memory.
3. Use progressive disclosure instead of a simple/advanced mode toggle.
4. Preserve every product capability; personalization changes emphasis, not
   availability.
5. Never activate outbound sending, integrations, or automations without the
   owner's explicit confirmation.
6. Keep role authorization server-side. UI preferences are presentation only.
7. Work in simulation mode with no external keys.

## Information architecture

The desktop navigation is grouped into four predictable sections:

| Group | Destination | Route | Previous label/location |
| --- | --- | --- | --- |
| Workspace | Today | `/dashboard` | Dashboard |
| Workspace | Inbox | `/inbox` | Chats |
| Workspace | Leads | `/contacts` | Contacts |
| Automation | AI Front Desk | `/agent` | AI Agent |
| Automation | Follow-ups | `/automations` | Settings sub-navigation |
| Automation | Campaigns | `/campaigns` | Campaigns |
| Insights | Analytics | `/analytics` | Orphan deep route |
| Manage | Integrations | `/integrations` | Settings sub-navigation |
| Manage | Settings | `/settings` | Settings |

The main navigation remains in this order for all users. Role filtering can
remove destinations a user cannot access, but the route taxonomy does not
change. Unauthorized deep links continue to return the existing friendly access
state and are enforced by `requireOrgContext`/`requireRole`.

Settings no longer repeats Follow-ups and Integrations. Its remaining sections
are grouped by business setup, channels and AI, and account and governance. On
small screens, settings use a labelled select/menu rather than a long horizontal
strip.

## App shell

### Desktop

- A calm, light-neutral sidebar replaces the full-height dark navigation slabs.
- Expanded width is approximately 232px. Rows are compact 44px targets.
- The active destination has a pale brand surface, stronger label, and a 3px
  marker. Color is never the only active-state cue.
- Workspace identity and test/live status appear at the top.
- Help, Customize workspace, and the account control sit at the bottom.
- The sidebar can collapse to approximately 72px. The collapsed preference is
  stored per member and every icon has a tooltip and accessible label.
- Deep routes keep the correct parent active, including `/automations`,
  `/integrations`, `/analytics`, and settings children.

### Top bar

The current contacts-only field is replaced by a command-style trigger labelled
"Search or jump to...". The initial implementation provides navigation and
quick actions plus a clear contacts-search path; it must not pretend to search
content that it does not index. Keyboard invocation and visible focus states are
required.

### Mobile

The bottom bar has exactly five labelled destinations:

`Today` · `Inbox` · `Front Desk` · `Leads` · `More`

More opens a full-width, focus-trapped sheet containing the remaining grouped
destinations, workspace status, account actions, and a visible close control.
The inbox thread keeps its current full-screen exception so the composer owns
the bottom edge.

## Today dashboard

The page is a single vertical decision flow, not a bento grid.

### 1. Compact status header

Show the greeting, date, business name, AI Front Desk status, and one primary
action. Avoid a large hero treatment.

### 2. Needs your attention

This is the dominant section. It ranks real, org-scoped exceptions such as:

- conversations handed to a human;
- pending owner questions;
- unread/open conversations;
- follow-up recovery that is not configured;
- setup blockers while the workspace is incomplete.

Each row states what happened, why it matters, and one clear next action. Show at
most four rows before a View all path. When there is nothing to handle, display
a compact positive state rather than removing the section and shifting the page.

### 3. Today's operations

Show a readable operational strip for bookings, follow-ups, payments, and leads
being chased. Values must come from existing domain queries; unavailable data is
labelled honestly rather than estimated.

### 4. AI Front Desk activity

Summarize the employee's work in plain language, for example: conversations
handled, appointments booked, follow-ups sent, and items escalated. This is not
an analytics chart.

### 5. Business pulse

Show no more than four outcome metrics with timeframe and context. Detailed
delivery charts stay in Analytics. Revenue remains explicitly labelled as
influenced/estimated where the existing calculation is used.

### 6. Setup and recent activity

Setup progress is prominent only while incomplete, then disappears from the
normal dashboard. Recent conversations and campaign activity become secondary
sections lower on the page.

Owners see the full business view. Team members use the same hierarchy but see
only activity and actions allowed by their role and number assignment.

## Personalized onboarding

First-run onboarding becomes a focused, resumable questionnaire rather than a
three-step settings form. It contains one decision per screen:

1. role and responsibility;
2. main business outcome;
3. typical customer journey;
4. team structure;
5. existing systems;
6. preferred guidance level;
7. recommended workspace and setup plan.

Business identity, country, and vertical remain part of the flow. WhatsApp
connection and contact import become recommended setup tasks after the profile
summary; neither blocks exploring simulation mode.

The final summary explains exactly what changed: dashboard priorities,
recommended shortcuts, and the ordered setup plan. It requires confirmation
before enabling any operational workflow.

The existing knowledge questionnaire remains separate and is renamed in the UI
to **Teach your Front Desk**. It teaches business facts; it does not profile the
user.

### Persistence and adaptation

- Organization-wide business answers and the recommended setup profile are
  stored under a namespaced `workspaceProfile` object in `Org.settings`.
- Per-member presentation preferences are stored in a dedicated
  `Membership.uiPreferences` JSON field.
- A deterministic mapping converts answers into dashboard priority and shortcut
  defaults. Runtime AI is not involved.
- The server validates allowed values and always merges JSON instead of
  overwriting unrelated settings.
- Each step autosaves. Returning users resume from the last completed step.
- Skip remains available and produces safe owner/operator defaults.
- Customize workspace can reset or adjust presentation preferences, but cannot
  change permissions or compliance behavior.

## Visual system

The authenticated product remains light and uses the existing Geist typography
and brand ramp. The generic motion-heavy/dark dashboard recommendation from the
design search is intentionally not adopted because it conflicts with the
approved calm, mixed-experience product direction.

- Neutral canvas, white surfaces, restrained 1px borders, and minimal shadow.
- Brand green is reserved for active navigation, primary actions, and positive
  operating states.
- Amber/red are reserved for warning/urgent states and always include text or an
  icon.
- Use one Lucide outline icon language. No emoji navigation icons.
- Spacing follows a 4/8px rhythm with section gaps of 24–32px.
- Body text is at least 16px on phone-sized screens; helper labels never fall
  below 12px.
- Motion uses opacity/transform only, usually 180–240ms. It communicates step
  direction or state change, remains interruptible, and respects
  `prefers-reduced-motion`.

## Responsive and accessibility requirements

- Verify at 375, 768, 1024, and 1440px.
- No authenticated page may create viewport-level horizontal scrolling.
- Controls wrap or stack before truncating essential labels.
- Every interactive target is at least 44px in either its visible or hit area.
- Include a skip-to-content link and a stable `main` target.
- Preserve sequential headings, logical tab order, visible focus, and AA text
  contrast.
- The More sheet and command menu manage focus, close with Escape, and restore
  focus to their trigger.
- Route changes identify the new main region to assistive technology.
- Loading, empty, success, and error states preserve layout and provide a
  recovery action.

## Data flow and safety

1. `requireOrgContext` loads the organization, membership, role, and preferences.
2. Dashboard query functions fetch only org-scoped operational data.
3. Pure dashboard functions rank attention items and create presentation
   summaries. They are deterministic and unit tested.
4. Server pages pass serializable view data into client components only where
   interaction is required.
5. Onboarding actions validate each answer, merge it into the correct org/member
   JSON object, revalidate affected routes, and never alter messaging or consent
   state.

No changes are made to send paths, consent gates, the 24-hour rule, model
routing, or tenant authorization.

## Error handling

- Autosave failure keeps the current answer locally, displays a specific inline
  retry message, and does not advance silently.
- Invalid or legacy preference JSON falls back to owner/operator defaults.
- Missing dashboard data renders a labelled unavailable state, never a
  fabricated zero.
- A failed dashboard subsection does not expose cross-org data and should not
  prevent core navigation from rendering.

## Testing strategy

- Unit tests for nav grouping, role filtering, and deep-route active states.
- Unit tests for onboarding answer validation, deterministic workspace profile
  mapping, safe defaults, and merge behavior.
- Unit tests for attention ranking and owner/agent visibility.
- Existing dashboard, consent, send, role, and simulation tests stay green.
- Build and lint must pass.
- Browser verification covers desktop and mobile shell, Today, onboarding,
  settings navigation, keyboard focus, reduced motion, and horizontal overflow.

## Out of scope for this slice

- A general-purpose universal search index.
- Drag-and-drop dashboard construction.
- Automatically enabling integrations, automations, campaigns, or outbound
  messages.
- Rewriting every feature page. The shell and responsive foundations should make
  those later page-level refinements incremental.
- A separate simple/advanced product mode.
