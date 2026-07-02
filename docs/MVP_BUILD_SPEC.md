# MVP BUILD SPEC — Nudge (WhatsApp CRM SaaS)

> The contract for the AiSensy/WATI-class MVP build. Every implementation agent
> reads this FIRST, then AGENTS.md (non-negotiable rules), then the code it owns.
> Product name: **Nudge** (existing). Live app: https://nudge-reach.vercel.app.

## 0. Ground rules (from AGENTS.md — enforced, not negotiable)

1. Official WhatsApp Cloud API only. `SEND_MODE=simulation` (default) must keep
   the ENTIRE product working end to end with mocked Meta responses.
2. Consent enforced in code: marketing sends only via `canSendMarketing()`;
   opt-outs permanent. Session (24h-window) replies are exempt (user-initiated).
3. Runtime AI = cheap Haiku tier via `lib/model-router` ONLY (`generate()`/
   `chat()`). Never bypass it, never hardcode models.
4. Platform modules stay channel-agnostic (auth, contacts, messaging, billing).
5. Keep `npm test`, `npm run lint`, `npm run build` green (Node 20:
   `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`).

## 1. Existing conventions (follow exactly)

- **Auth**: `requireOrg()` from `lib/auth.ts` at the top of every protected page
  and server action (returns `Org`, unchanged). Role-aware code uses the new
  `requireOrgContext()` (see §3.1). Both are React-`cache()`d per request.
- **Server actions**: `"use server"` files named `actions.ts` per route folder.
  Input `FormData`, output `Promise<ActionResult>` = `{ ok: boolean; message:
  string }` (or `void` for trivial deletes). Never throw to the client; catch
  and return `{ ok:false, message }`. `revalidatePath()` after mutations.
  Org-scope every query (`where: { orgId: org.id }` or scoped lookups).
- **Client forms**: React 19 `useActionState()`; button disabled on `pending`;
  result shown via `<Toast>`/inline feedback. No separate useState form state.
- **"Real-time"**: lightweight polling à la `StatsDashboard` — a small
  authenticated GET API route + client `fetch(..., {cache:"no-store"})` on a
  2.5–4s interval, stopping when settled. Never `router.refresh()` loops.
- **Phones**: always `normalizePhoneE164()`. **Money**: minor units (paise) +
  `formatInr()`. **Dates**: store UTC, render `en-IN`.
- **Path alias**: `@/*`. Icons: `lucide-react`. Charts: `recharts` (installed).

## 2. Design system (authenticated app)

Light-only. Brand tokens already exist in `app/globals.css` (`--color-brand-*`,
`shadow-soft/lift`, fonts Geist / Geist Mono; Instrument Serif is marketing-only).

- **Shell**: dark ink-green sidebar `bg-brand-950` (deep #07261c) w/ logo,
  nav items `text-brand-100/70`, active = `bg-white/10 text-white` + 2px
  `bg-brand-400` left accent. Content area `bg-neutral-50`. Topbar: white,
  `border-b border-black/5`, global search input, org name, user menu.
- **Cards**: `rounded-2xl border border-black/5 bg-white shadow-soft` (p-5/p-6).
- **Primary button**: `bg-brand-600 hover:bg-brand-700 text-white rounded-lg
  text-sm font-medium px-4 h-9`; secondary: white + `border-neutral-200
  hover:bg-neutral-50`; danger: `bg-red-600`; ghost: `hover:bg-black/5`.
- **Focus**: `focus-visible:ring-2 ring-brand-400/50 outline-none`.
- **Badges** (rounded-full px-2 py-0.5 text-xs font-medium): success
  `bg-emerald-50 text-emerald-700`, warning `bg-amber-50 text-amber-700`,
  danger `bg-red-50 text-red-700`, info `bg-sky-50 text-sky-700`, neutral
  `bg-neutral-100 text-neutral-600`, brand `bg-brand-50 text-brand-700`.
- **Tables**: `text-sm`, header `text-xs font-medium uppercase tracking-wide
  text-neutral-400`, rows `border-t border-neutral-100 hover:bg-neutral-50`.
- **Type**: page title `text-xl font-semibold text-neutral-900` inside
  `<PageHeader>`; section `text-sm font-semibold`; body `text-sm`; meta
  `text-xs text-neutral-500`.
- **Empty states**: icon in `bg-brand-50 text-brand-600` circle, one sentence,
  one primary CTA. **Loading**: `<Skeleton>` blocks, no spinners on pages.
- Motion: subtle only — 150–200ms color/shadow transitions, `animate-rise` for
  toasts/modals. No marketing mesh/marquee inside the app.

## 3. Foundation (built before modules; modules consume, never edit)

### 3.1 Auth, org, roles
- `lib/org.ts` → `resolveOrgContext(userId, email)`: find `Membership` by
  userId → its org; else pending `Invite` matching email → accept (create
  membership, mark accepted); else create org + OWNER membership (race-safe).
  Existing orgs get their OWNER membership backfilled lazily here.
- `lib/auth.ts` → NEW `requireOrgContext(): Promise<OrgContext>` wrapped in
  React `cache()`; `OrgContext = { org: Org; membership: Membership; role:
  OrgRole; userId: string; email: string }`. Helper `requireRole(ctx, "ADMIN")`
  for owner/admin-gated mutations. **`requireOrg()` KEEPS returning `Org`**
  (internally `(await requireOrgContext()).org`) so no existing call site
  changes.
- Roles: `OWNER` (everything), `ADMIN` (everything but billing/org-delete),
  `AGENT` (inbox + contacts read/write, no settings/campaign send).

### 3.2 Prisma schema additions (all additive; enums extended, nothing dropped)
New enums: `OrgRole { OWNER ADMIN AGENT }`, `LeadStage { NEW CONTACTED
QUALIFIED WON LOST }`, `AutomationRunStatus { RUNNING WAITING COMPLETED
FAILED }`. Extend `CampaignStatus` with `SCHEDULED`; `TemplateStatus` with
`DRAFT`.

New models (all org-scoped, `onDelete: Cascade` from Org, `@@index([orgId])`):
- `Membership { id, orgId, userId, email, displayName?, role OrgRole @default(AGENT), notificationPrefs Json @default("{}"), createdAt } @@unique([orgId, userId]) @@index([userId])`
- `Invite { id, orgId, email, role, status String @default("pending"), createdAt } @@unique([orgId, email])`
- `Tag { id, orgId, name, color String @default("emerald"), createdAt } @@unique([orgId, name])` + join tables `ContactTag { contactId, tagId @@id([contactId, tagId]) }`, `ConversationTag { conversationId, tagId @@id([conversationId, tagId]) }`
- `Note { id, orgId, contactId?, conversationId?, authorUserId, authorName, body, createdAt }` (internal notes; index contactId + conversationId)
- `Automation { id, orgId, name, description @default(""), enabled @default(false), trigger String, triggerConfig Json @default("{}"), createdAt, updatedAt }`
  - trigger ∈ `message_received | keyword | contact_created | tag_added | campaign_reply`
- `AutomationStep { id, automationId, order Int, kind String, config Json @default("{}") } @@unique([automationId, order])`
  - kind ∈ `send_message | send_template | add_tag | assign_agent | update_lead_stage | wait | resolve_conversation | handoff_to_human`
- `AutomationRun { id, automationId, orgId, contactId?, conversationId?, status AutomationRunStatus @default(RUNNING), currentStep Int @default(0), resumeAt DateTime?, log Json @default("[]"), createdAt, updatedAt } @@index([status, resumeAt])`
- `ApiKey { id, orgId, name, prefix, keyHash @unique, lastUsedAt?, revokedAt?, createdAt }`

Extended models:
- `Org` + `vertical String?`, `onboardedAt DateTime?`, `settings Json @default("{}")`
  (free-form org preferences, e.g. `avgOrderValueInr`; + relations to new models)
- `Contact` + `email String?`, `leadStage LeadStage @default(NEW)`,
  `assignedToUserId String?`, `lastContactedAt DateTime?`, `source` stays
  `optInSource`; + relations tags/notes
- `Conversation` + `assignedToUserId String?`, `unreadCount Int @default(0)`,
  `lastMessageAt DateTime?`, `lastMessagePreview String?`; + tags/notes.
  `status` string now ∈ `open | pending | resolved | handoff`
  (existing `closed` rows are treated as `resolved` in queries; `handoff`
  displays under Open with a "Needs human" badge).
- `Campaign` + `scheduledAt DateTime?`, `sourceTemplateId String?`
- `Template` + `orgId String?` (+ Org relation), `campaignId` → OPTIONAL,
  `content Json?` (§7-shape source for library templates; `componentsJson`
  remains the Meta payload)

### 3.3 RLS
`scripts/enable-rls.ts` (esbuild-bundled like seed) runs
`ALTER TABLE "X" ENABLE ROW LEVEL SECURITY` over every table via Prisma
(`$executeRawUnsafe`, DIRECT_URL). Idempotent; run after every `db:push`.
New npm script `db:rls`.

### 3.4 Seed (`scripts/seed-demo.ts`, rewritten, idempotent, no AI calls)
One demo org (first org found, same as today): ~40 contacts (Indian names,
mixed leadStage/tags/sources/emails, a few opted-out), 6 tags, 3 audiences,
10 conversations (varied status/assignment/unread, 4–12 messages each, some
notes, one handoff), 4 library templates (approved/pending/draft/rejected),
3 campaigns (SENT w/ full Message stats via the real sim helpers, SCHEDULED,
DRAFT), 3 automations (keyword FAQ, welcome on contact_created, tag→assign;
one with runs/logs), 1 API key row (hash of a throwaway), memberships:
the owner + 2 fictional teammate memberships (fake userIds `demo-agent-1/2`,
used for assignment dropdowns).

### 3.5 UI kit — `components/ui/*` (client components where interactive)
`button.tsx (Button, buttonVariants)`, `card.tsx (Card, CardHeader…)`,
`badge.tsx (Badge tone=…)`, `input.tsx / textarea.tsx / select.tsx /
label.tsx / field.tsx (label+input+error)`, `switch.tsx`, `table.tsx
(DataTable with client search/sort/pagination + plain Table primitives)`,
`modal.tsx (Modal, ConfirmDialog)`, `drawer.tsx (right-side panel)`,
`tabs.tsx`, `dropdown.tsx (Menu)`, `toast.tsx (ToastProvider + useToast; rendered
in app layout)`, `empty-state.tsx`, `skeleton.tsx`, `stat-card.tsx (label,
value, delta?, icon?)`, `page-header.tsx (title, description?, actions slot)`,
`avatar.tsx (initials)`, `tag-pill.tsx`, `spinner.tsx`, `progress.tsx`.
Modules MUST use the kit — no bespoke buttons/inputs/badges.

### 3.6 App shell
Route group `app/(app)/` with `layout.tsx` (calls `requireOrg()`, renders
`<Sidebar>` `components/app/sidebar.tsx` + `<Topbar>` + `<ToastProvider>`).
Existing pages MOVE into the group (URLs unchanged): dashboard, contacts,
campaigns, settings. `/conversations` is replaced by `/inbox` (module 2) with a
`redirect()` stub left at `app/(app)/conversations/page.tsx` and
`[id]` → `/inbox/[id]`.
Sidebar nav (exact order): Dashboard `/dashboard`, Inbox `/inbox`, Contacts
`/contacts`, Campaigns `/campaigns`, Templates `/templates`, Automations
`/automations`, Analytics `/analytics`, Integrations `/integrations`,
Settings `/settings`. Bottom: simulation-mode pill (when
`SEND_MODE=simulation`), user block w/ sign-out.
AGENT role hides: Templates, Automations, Analytics, Integrations, Settings
(server-checked too).

## 4. Modules (parallel agents — STRICT file ownership)

Every module: use the kit, follow §1 conventions, real Prisma persistence
(mock only external Meta/AI as noted), loading.tsx + error.tsx + empty states,
no dead buttons (label "Coming soon" chips where stubbed), `npx tsc --noEmit`
+ `npm test` must pass when you finish. Do NOT run `next build`, `db:push`,
`npm install`, or edit files outside your ownership list — if you need a
shared change, return it as a NEEDS note in your final message.

### M1 — Dashboard home + onboarding
**Owns**: `app/(app)/dashboard/*`, `app/(app)/onboarding/*`, `lib/dashboard/`.
Dashboard: greeting + onboarding checklist card (connect WhatsApp → import
contacts → create template → first campaign → enable automation; each links
out, computed from real data); stat row (contacts, open conversations,
campaigns sent, messages delivered/read/replied rates, active automations,
"revenue influenced" placeholder = won-stage contacts × configurable avg order
value with an "estimate" label); Recent conversations (5) + Recent campaigns
(5) lists; Quick actions (New broadcast, Add contact, New automation, Connect
WhatsApp). Onboarding `/onboarding`: 3-step wizard (business name+vertical →
WhatsApp connect-or-simulation notice → import contacts CTA) writing
`Org.vertical/onboardedAt`; dashboard redirects here when `onboardedAt` null
AND org has no contacts (skippable, sets onboardedAt).

### M2 — Shared inbox + AI assist
**Owns**: `app/(app)/inbox/*`, `app/(app)/conversations/*` (redirect stubs),
`lib/inbox/`, `lib/ai/suggest-reply.ts`, `app/api/inbox/**` (poll endpoints).
Three-pane: conversation list (search contact/phone/last message; filters All,
Open, Mine, Unassigned, Resolved, Unread as query params; unread dot +
handoff "Needs human" badge; 24h-window countdown chip) — thread (bubbles,
day separators, status ticks for outbound, composer: free-form send within
`isWithinServiceWindow` else disabled with "window closed — send a template"
switch to approved-template picker w/ variable fill) — context panel (contact
card: stage select, tags add/remove, assignee select from memberships, notes
timeline, link to /contacts/[id], conversation status buttons Open/Pending/
Resolved). Sends: `sendMessage("whatsapp", …, {kind:"text"|template})` +
`ConversationMessage` row + `lastMessageAt/Preview` update; opening a thread
zeroes `unreadCount`. Polling: list + thread lightweight GET endpoints (org-
scoped auth like `/api/campaigns/[id]/stats`). AI assist: "Suggest reply"
button + tone chips (Professional/Friendly/Short/Persuasive) → server action
calling `chat()` grounded on last ~10 turns + AgentProfile business info;
returns draft into composer (NEVER auto-send); if no `ANTHROPIC_API_KEY`,
return deterministic canned draft labeled "sample". Keep sim-tester (send an
inbound as the customer) available in simulation mode.

### M3 — Contacts CRM
**Owns**: `app/(app)/contacts/*` (incl. `[id]/`), `lib/segments.ts`.
List: DataTable (name, phone, email, tags, stage, assignee, source, opt-in
badge, last contacted, created) w/ search, filter bar (stage, tag, opt-in,
assignee), CSV import modal (existing consent-confirmation flow preserved),
add-contact modal, bulk actions (tag, stage, audience add). Profile
`/contacts/[id]`: header (avatar, consent status, opt-out action), editable
fields (name/email/phone/stage/assignee/tags), notes timeline (add note),
conversation + campaign-message history, danger zone delete. Segments =
saved filters stored as `Audience` extension? NO — keep Audiences as-is
(static lists) and add `lib/segments.ts` filter-builder (stage/tag/optIn/
source) used by list filters and campaign audience picker ("dynamic segment"
option materializes to an Audience at send time). Tags manager (rename/color/
delete) in a drawer.

### M4 — Campaigns (broadcasts)
**Owns**: `app/(app)/campaigns/*`, `lib/send/queue.ts` (extend), scheduling
bits of `app/api/cron/process-queue/route.ts`.
List: DataTable (name, status badge incl. Scheduled, audience, sent/delivered/
read, cost, created) + "New broadcast". New flow becomes a wizard: (1) content
— generate-from-photo (existing path) OR pick approved library template OR
blank; (2) audience — pick Audience or dynamic segment (via lib/segments) w/
opted-in count + est. cost; (3) review — WhatsApp preview w/ variable
substitution + compliance interstitial (opt-in confirmation checkbox, Meta
policy note) + send now / schedule later (datetime). SCHEDULED campaigns:
`scheduledAt`, cron tick enqueues due ones (extend cron route + a
`releaseDueCampaigns()` in queue.ts). Detail page: keep editor/approval/run
for drafts; SENT/SENDING shows stats dashboard (existing) + per-recipient
table w/ statuses. Personalisation: `{{1}}` stays canonical (Meta), but the
editor shows it as `{{name}}` friendly chip; body params map name.

### M5 — Template library
**Owns**: `app/(app)/templates/*`, `lib/whatsapp/library.ts`.
Org-scoped `Template` rows (campaignId null): list w/ status badges + category
filter; create/edit form (name w/ slugify preview, category MARKETING/UTILITY/
AUTHENTICATION, language, header text-or-image-URL, body w/ {{n}} variable
chips + sample values, footer w/ opt-out enforcement for MARKETING (reuse
`repairOptOutFooter`), up to 3 buttons) + live WhatsappPreview; submit →
`metaStatus PENDING` → mock approval after 10s (reuse approval pattern; live
path stubbed behind SEND_MODE), reject shows reason + edit-resubmit; delete
(DRAFT/REJECTED only). Approved templates feed M2's template sender and M4's
wizard via `getApprovedTemplates(orgId)` in library.ts.

### M6 — Automations
**Owns**: `app/(app)/automations/*`, `lib/automation/*`,
`lib/agent/inbound.ts` (trigger wiring), `tests/automation.test.ts`.
Engine `lib/automation/engine.ts`: `matchAutomations(trigger, ctx)` (pure,
keyword matching contains/exact per config, unit-tested) +
`runAutomation(automationId, ctx)` executing steps sequentially with per-step
log entries; `wait` sets `status WAITING, resumeAt` (resumed by
`tickAutomationRuns()` — exported for cron/integration); actions reuse
sendMessage/tags/assign/leadStage/conversation-status/handoff. Trigger wiring:
`message_received`+`keyword`+`campaign_reply` inside `handleInboundMessage`
(BEFORE the AI agent reply; if an automation sends a reply, skip AI double-
reply), `contact_created` in a small hook `lib/automation/triggers.ts` called
from contact-create paths (M3 actions call it — coordinate via NEEDS note if
signature unclear; default export `fireContactCreated(orgId, contactId)`),
`tag_added` likewise. Builder UI: step-based (not canvas): trigger picker w/
config (keywords input, tag select), ordered step list (add/remove/reorder,
config per kind, template picker for send_template), enable toggle, test-run
button (simulation: runs against a chosen contact), runs log page w/ per-step
results. List: name, trigger, steps count, enabled switch, last run, runs.

### M7 — Analytics
**Owns**: `app/(app)/analytics/*`, `lib/analytics/queries.ts`,
`components/charts/*`.
Server-computed from real data (last 30d default, 7/30/90 picker): message
volume by day (in vs out, area chart), delivery/read/reply rates (stat cards
w/ deltas), campaign performance table (per campaign: sent/delivered/read/
clicked/cost), agent performance (per membership: assigned, resolved, avg
first-response time from inbound→outbound gaps), lead funnel (stage counts,
horizontal funnel), top tags. recharts wrappers in components/charts (client)
fed serialized props; consistent brand colors; skeleton loading; empty state
pointing to seed/demo. No fabricated numbers where real zeros exist — show
honest empties.

### M8 — Settings + Integrations
**Owns**: `app/(app)/settings/*` (incl. moves of existing whatsapp+agent
pages), `app/(app)/integrations/*`, `lib/api-keys.ts`.
Settings layout w/ left sub-nav: General (org name, vertical, avg order value
₹ — persisted to `Org.settings.avgOrderValueInr`, default 1499; M1's revenue
metric reads it), Team (members table w/ role
change (owner/admin only), invite by email → Invite row + "pending" chip;
explain auto-join on signup), AI Agent (move existing agent-form), WhatsApp
(move existing connect form), Notifications (per-member toggles persisted to
`Membership.notificationPrefs`), Billing (placeholder plans card, current
usage = messages this month + est. cost, "Payments coming soon"), Data export
(placeholder button w/ Coming soon).
Integrations `/integrations`: WhatsApp Cloud API card (status from
WhatsappAccount, connect/edit → settings/whatsapp, webhook URL display w/
copy + verify-token hint, "Test connection" button → server action: simulation
returns ok, live pings Graph API `GET /{phone_number_id}`), API keys section
(create → show-once full key `nk_…` (sha256 hash stored via lib/api-keys.ts,
prefix shown in table), revoke), placeholder cards Zapier/Make/Webhooks w/
Coming soon chips. `/settings/whatsapp` + `/settings/agent` keep working
(moved under the settings layout, old URLs preserved).

## 5. Integration phase (orchestrator, after modules)
Cron route composition (queue tick + due campaigns + automation resume),
cross-module NEEDS notes, full `npm run build` + `lint` + `test`, seed run,
manual flow verification, marketing-page link check (`/login` CTAs), review
workflow, fixes, PROGRESS.md entry, commit.

## 6. What stays mocked (visually complete, swap-ready)
Meta template approval + sends (simulation driver), AI without API key
(canned drafts), billing/payments, Zapier/Make cards, data export, invite
emails (auto-join on signup instead), revenue metric (labeled estimate).
