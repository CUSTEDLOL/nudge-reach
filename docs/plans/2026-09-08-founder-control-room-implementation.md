# Founder Control Room Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `/admin` a founder-only, production-robust operations console with truthful readiness, safe audited mutations, actionable system health, complete launch workflows, and accessible failure recovery.

**Architecture:** Keep routes thin and extend the existing `src/modules/admin` bounded context. Centralize readiness, founder-action error handling, audit transaction helpers, operation severity, and retry eligibility as deterministic functions with focused tests. Reuse existing org-scoped product modules for real actions, preserve the server-side founder gate on every page/action, and never add a new messaging path or expose message bodies/secrets.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Prisma/Postgres, Supabase Auth, Vitest, existing Nudge UI primitives.

---

## Execution rules

- Work only in the `founder-control-room` worktree.
- Before implementation, merge the current `origin/main` into the branch so the
  two voice fixes that landed after the admin branch are retained.
- Follow test-driven development for every behavioral change: failing test,
  minimal implementation, passing focused test, then commit.
- Never stage the unrelated landing-page assets or edits in the original main
  worktree.
- Do not run a destructive database command. The only schema rollout in this
  plan is an additive `SystemHeartbeat` table via `npm run db:push`, followed by
  `npm run db:rls`.
- Browser verification must use a simulated organization and must not send live
  messages, alter real billing, disconnect a live integration, or inspect
  customer message content.

### Task 1: Integrate the current mainline and establish a green baseline

**Files:**
- Verify only: repository state

**Step 1: Merge the latest known mainline**

Run:

```bash
git merge --no-ff origin/main
```

Expected: the two voice commits merge without changing the approved admin
design. Resolve only genuine conflicts; do not rewrite either feature stream.

**Step 2: Install from the lockfile if the worktree has no dependencies**

Run:

```bash
npm ci
```

Expected: dependencies install without editing `package-lock.json`.

**Step 3: Run the focused admin baseline**

Run:

```bash
npx vitest run tests/admin-gate.test.ts tests/admin-queries.test.ts tests/admin-events.test.ts tests/admin-ops.test.ts tests/admin-set-plan.test.ts tests/admin-suspension.test.ts tests/admin-org-controls.test.ts tests/admin-team.test.ts tests/admin-leads.test.ts tests/admin-revenue.test.ts tests/admin-usage.test.ts
```

Expected: the existing suspension test may fail by attempting the configured
database; record that as the first defect. No other admin test may fail.

**Step 4: Verify static health**

Run:

```bash
npx eslint src/app/admin src/modules/admin src/components/features/admin-shell tests/admin-*.test.ts
npm run build
```

Expected: both commands pass.

No commit is needed for this task.

### Task 2: Fix test isolation and make readiness truthful

**Files:**
- Modify: `tests/admin-suspension.test.ts`
- Create: `tests/admin-readiness.test.ts`
- Modify: `src/modules/concierge/index.ts`
- Modify: `src/app/admin/orgs/[id]/page.tsx`
- Modify: any client concierge consumer identified by TypeScript

**Step 1: Write the readiness regression tests**

Mock Prisma in `tests/admin-readiness.test.ts` and cover the full matrix:

```ts
it("is blocked without a usable WhatsApp account", async () => {
  prisma.whatsappAccount.count.mockResolvedValue(0);
  const status = await getConciergeStatus("org_1");
  expect(status.whatsappConnected).toBe(false);
  expect(status.ready).toBe(false);
});

it("is ready only when every required dependency is usable", async () => {
  prisma.whatsappAccount.count.mockResolvedValue(1);
  const status = await getConciergeStatus("org_1");
  expect(status).toMatchObject({ whatsappConnected: true, ready: true });
});
```

Use `status: "connected"` in the WhatsApp count query so a disconnected row
cannot satisfy readiness.

**Step 2: Make the suspension test fail for the intended reason only**

Replace the partial import-original mock with a complete deterministic mode
mock:

```ts
const { isOrgSuspended, orgSendMode } = vi.hoisted(() => ({
  isOrgSuspended: vi.fn(),
  orgSendMode: vi.fn().mockResolvedValue("simulation"),
}));

vi.mock("@/modules/orgs/mode", () => ({
  isOrgSuspended,
  orgSendMode,
  sendModeFor: () => "simulation",
}));
```

**Step 3: Run the tests and confirm failure**

Run:

```bash
npx vitest run tests/admin-readiness.test.ts tests/admin-suspension.test.ts
```

Expected: suspension passes; readiness fails because `whatsappConnected` does
not exist and `ready` ignores WhatsApp.

**Step 4: Implement the single readiness computation**

Extend `ConciergeStatus` and `getConciergeStatus`:

```ts
export interface ConciergeStatus {
  whatsappConnected: boolean;
  agentConfigured: boolean;
  agentEnabled: boolean;
  calendarConnected: boolean;
  approvedTemplates: number;
  followUpEnabled: boolean;
  ready: boolean;
}
```

Load `prisma.whatsappAccount.count({ where: { orgId, status: "connected" } })`
in the existing `Promise.all`, and include `whatsappConnected` in the `ready`
conjunction. Update the admin overview checklist to use this field instead of
its separate `_count` so the label and badge cannot disagree.

**Step 5: Run focused and type verification**

Run:

```bash
npx vitest run tests/admin-readiness.test.ts tests/admin-suspension.test.ts tests/concierge.test.ts
npx tsc --noEmit
```

Expected: pass.

**Step 6: Commit**

```bash
git add tests/admin-readiness.test.ts tests/admin-suspension.test.ts src/modules/concierge/index.ts 'src/app/admin/orgs/[id]/page.tsx'
git commit -m "fix(admin): make workspace readiness truthful"
```

### Task 3: Centralize safe founder-action results

**Files:**
- Create: `src/modules/admin/actions.ts`
- Create: `tests/admin-actions.test.ts`
- Modify: `src/app/admin/orgs/[id]/actions.ts`
- Modify: `src/app/admin/leads/actions.ts`

**Step 1: Write failing wrapper tests**

Test that authorization occurs outside the catch boundary, ordinary exceptions
become a safe result, and internal text is not returned:

```ts
it("does not swallow founder denial", async () => {
  requireFounder.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));
  await expect(runFounderAction(async () => ({ ok: true, message: "ok" })))
    .rejects.toThrow("NEXT_NOT_FOUND");
});

it("normalizes unexpected action failures", async () => {
  requireFounder.mockResolvedValue({ email: "founder@nudge.test" });
  const result = await runFounderAction(async () => {
    throw new Error("postgres password and internal stack");
  });
  expect(result).toEqual({
    ok: false,
    message: "That change could not be completed. Nothing else was changed. Try again.",
  });
});
```

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-actions.test.ts
```

Expected: FAIL because the wrapper does not exist.

**Step 3: Implement the wrapper**

Create a shared result type and wrapper:

```ts
export type AdminActionResult = { ok: boolean; message: string };

export async function runFounderAction(
  work: (founder: FounderContext) => Promise<AdminActionResult>
): Promise<AdminActionResult> {
  const founder = await requireFounder();
  try {
    return await work(founder);
  } catch {
    return {
      ok: false,
      message: "That change could not be completed. Nothing else was changed. Try again.",
    };
  }
}
```

Refactor every exported server action under `src/app/admin` to call this
wrapper. Keep parsing and module calls inside the callback. Do not catch
`requireFounder`/`notFound`.

**Step 4: Test every exported action uses the gate**

In `tests/admin-actions.test.ts`, mock `requireFounder`, call representative
actions from organization and lead routes, and assert the handler does not
touch mocked data modules when authorization rejects. This is behavioral—not a
source-string test.

**Step 5: Run the action/admin tests**

Run:

```bash
npx vitest run tests/admin-actions.test.ts tests/admin-leads.test.ts tests/admin-org-controls.test.ts tests/admin-team.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/modules/admin/actions.ts tests/admin-actions.test.ts 'src/app/admin/orgs/[id]/actions.ts' src/app/admin/leads/actions.ts
git commit -m "fix(admin): normalize founder action failures"
```

### Task 4: Make database mutations and audit rows atomic

**Files:**
- Modify: `src/modules/admin/audit.ts`
- Modify: `src/modules/admin/org-controls.ts`
- Modify: `src/modules/admin/set-plan.ts`
- Modify: `src/modules/admin/team.ts`
- Modify: `tests/admin-org-controls.test.ts`
- Modify: `tests/admin-set-plan.test.ts`
- Modify: `tests/admin-team.test.ts`

**Step 1: Add rollback-oriented failing tests**

Update Prisma mocks so `$transaction` executes a callback with the mocked
transaction client. Assert the mutation and audit are issued from the same
client:

```ts
expect(prisma.$transaction).toHaveBeenCalledTimes(1);
expect(tx.org.update).toHaveBeenCalledWith(expectedUpdate);
expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
  data: expect.objectContaining({ action: "admin.trial_changed" }),
}));
```

Add equivalent assertions for plan changes, member role/removal, invite revoke,
and ownership transfer. Add a simulated audit failure and assert the transaction
promise rejects; the caller wrapper from Task 3 must return the safe failure.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-org-controls.test.ts tests/admin-set-plan.test.ts tests/admin-team.test.ts tests/admin-actions.test.ts
```

Expected: FAIL because updates and audit writes currently happen separately.

**Step 3: Make `founderAudit` transaction-aware**

Define the smallest audit client type and optional client parameter:

```ts
type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function founderAudit(
  orgId: string,
  founderEmail: string,
  action: FounderAuditAction,
  target?: string | null,
  detail?: string | null,
  db: AuditClient = prisma
): Promise<void> {
  await db.auditLog.create({ data: auditData(/* });
}
```

**Step 4: Convert direct database actions to callback transactions**

Use this shape consistently:

```ts
await prisma.$transaction(async (tx) => {
  await tx.org.update({ where: { id: org.id }, data });
  await founderAudit(org.id, founderEmail, action, org.name, detail, tx);
});
```

For ownership transfer, move its existing three writes and audit creation into
one callback transaction. Keep precondition reads org-scoped and recheck the
critical owner condition inside the transaction before demotion/deletion.

**Step 5: Run the focused tests**

Run:

```bash
npx vitest run tests/admin-org-controls.test.ts tests/admin-set-plan.test.ts tests/admin-team.test.ts tests/admin-actions.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/modules/admin/audit.ts src/modules/admin/org-controls.ts src/modules/admin/set-plan.ts src/modules/admin/team.ts tests/admin-org-controls.test.ts tests/admin-set-plan.test.ts tests/admin-team.test.ts tests/admin-actions.test.ts
git commit -m "fix(admin): transact privileged changes with audits"
```

### Task 5: Add mandatory reasons and typed critical confirmations

**Files:**
- Modify: `src/components/features/admin-shell/action-form.tsx`
- Create: `src/modules/admin/confirmation.ts`
- Create: `tests/admin-confirmation.test.ts`
- Modify: `src/app/admin/orgs/[id]/actions.ts`
- Modify: `src/app/admin/orgs/[id]/controls/page.tsx`
- Modify: `src/app/admin/orgs/[id]/team/page.tsx`
- Modify: `src/app/admin/orgs/[id]/integrations/page.tsx`
- Modify: `src/app/admin/orgs/[id]/agent/page.tsx`

**Step 1: Write pure confirmation tests**

```ts
expect(confirmationMatches("Glow Clinic", " glow clinic ")).toBe(true);
expect(confirmationMatches("Glow Clinic", "Glow")).toBe(false);
expect(requireReason("  ")).toEqual({ ok: false, error: expect.any(String) });
```

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-confirmation.test.ts
```

Expected: FAIL because helpers do not exist.

**Step 3: Implement deterministic server validation**

`confirmationMatches` performs trimmed, case-insensitive exact matching.
`requireReason` requires 3–500 characters and returns the trimmed value. Critical
module functions accept `confirmation` and validate it against the loaded org
name or target email/label; UI confirmation alone is never trusted.

**Step 4: Extend `ActionForm`**

Add:

```ts
confirmText?: { expected: string; label: string };
```

Render a labelled input inside the dialog, copy it into FormData as
`confirmation`, and disable the confirmation button until the exact normalized
text matches. Keep the form values on failure. Require `reason` for all
account-changing actions and show a local validation message before invoking
the server.

**Step 5: Apply protection levels**

- Reason + confirmation: plan, trial, subscription, role, limits, agent and
  follow-up switches.
- Typed target + reason: go-live, suspension, ownership transfer, integration
  disconnection, API-key revocation.
- Direct: founder notes and lead status/notes.

Use the organization name for workspace-wide actions and the target email,
number, endpoint host, or key prefix for resource actions.

**Step 6: Run focused tests and lint**

Run:

```bash
npx vitest run tests/admin-confirmation.test.ts tests/admin-actions.test.ts tests/admin-org-controls.test.ts tests/admin-team.test.ts
npx eslint src/components/features/admin-shell/action-form.tsx src/modules/admin/confirmation.ts 'src/app/admin/orgs/[id]'
```

Expected: pass.

**Step 7: Commit**

```bash
git add src/components/features/admin-shell/action-form.tsx src/modules/admin/confirmation.ts tests/admin-confirmation.test.ts 'src/app/admin/orgs/[id]'
git commit -m "feat(admin): protect critical founder actions"
```

### Task 6: Complete founder team invitations

**Files:**
- Modify: `src/modules/admin/team.ts`
- Modify: `src/app/admin/orgs/[id]/actions.ts`
- Modify: `src/app/admin/orgs/[id]/team/page.tsx`
- Modify: `tests/admin-team.test.ts`

**Step 1: Write failing invite tests**

Cover invalid email, invalid role, existing member, pending invite, team-plan
limit, successful upsert, email-configured success/failure, resend, org scoping,
and audit attribution. The successful test should assert the email says "AI
Front Desk", not "WhatsApp CRM".

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-team.test.ts
```

Expected: FAIL because founder invite/resend functions do not exist.

**Step 3: Implement module functions**

Add `inviteMember` and `resendInvite` to `src/modules/admin/team.ts`. Reuse
`checkTeamLimit`, `appOrigin`, `isEmailConfigured`, and `sendEmail`; escape every
HTML interpolation. Upsert only within `orgId_email`. Write the invite row and
audit in one database transaction; sending email happens after commit and its
delivery result is recorded in a second audit row without failing the valid
invite.

**Step 4: Add route actions and UI**

Add a compact labelled form above pending invitations with email and Admin/Agent
role. Pending rows gain Resend and Revoke actions. Disable Resend when email is
not configured and explain that signup auto-accept still works.

**Step 5: Run tests and lint**

Run:

```bash
npx vitest run tests/admin-team.test.ts tests/admin-actions.test.ts
npx eslint src/modules/admin/team.ts 'src/app/admin/orgs/[id]/team/page.tsx' 'src/app/admin/orgs/[id]/actions.ts'
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/modules/admin/team.ts tests/admin-team.test.ts 'src/app/admin/orgs/[id]/actions.ts' 'src/app/admin/orgs/[id]/team/page.tsx'
git commit -m "feat(admin): manage founder-assisted team invites"
```

### Task 7: Make organization discovery actionable and responsive

**Files:**
- Modify: `src/modules/admin/queries.ts`
- Modify: `src/app/admin/orgs/page.tsx`
- Create: `src/components/features/admin-shell/org-directory.tsx`
- Modify: `tests/admin-queries.test.ts`

**Step 1: Write failing filter/sort/readiness tests**

Add `readiness` and `sort` to `OrgsFilter`. Test server validation for:

```ts
ORG_READINESS = ["all", "ready", "blocked", "degraded"];
ORG_SORTS = ["newest", "name", "last_activity", "trial_end", "cost"];
```

For the launch-scale dataset, fetch at most 500 filtered organizations, join
30-day costs and last inbound timestamps, derive readiness, sort deterministically
in memory, and paginate with a numeric page. Test stable tie-breaking by ID and
out-of-range pages.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-queries.test.ts
```

Expected: FAIL for missing filter/sort fields.

**Step 3: Extend the query safely**

Select only readiness metadata: connected WhatsApp count, configured knowledge
count, agent enabled/configured fields, calendar existence, approved library
template count, and follow-up enabled. Do not select access tokens,
`ConversationMessage.body`, or credentials.

Extract a pure `sortOrgRows(rows, sort)` and `paginate(rows, page, pageSize)` to
keep behavior testable. Return `page`, `pageCount`, and `total`.

**Step 4: Build desktop and mobile presentations**

`OrgDirectory` renders a semantic sortable table from `md` upward and stacked
organization rows below `md`. Both variants contain the same core fields and
links. Filter controls use 44-pixel targets, retain current filters, and offer a
clear reset.

**Step 5: Run tests and lint**

Run:

```bash
npx vitest run tests/admin-queries.test.ts tests/admin-readiness.test.ts
npx eslint src/modules/admin/queries.ts src/app/admin/orgs/page.tsx src/components/features/admin-shell/org-directory.tsx
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/modules/admin/queries.ts src/app/admin/orgs/page.tsx src/components/features/admin-shell/org-directory.tsx tests/admin-queries.test.ts
git commit -m "feat(admin): improve organization discovery"
```

### Task 8: Add lead search, pagination, and duplicate signals

**Files:**
- Modify: `src/modules/admin/leads.ts`
- Modify: `src/app/admin/leads/page.tsx`
- Modify: `src/app/admin/leads/lead-row.tsx`
- Modify: `tests/admin-leads.test.ts`

**Step 1: Write failing lead-list tests**

Test case-insensitive search across name/email/city/phone, deterministic merged
pagination, total/page counts, and duplicate flags for normalized phone or
lowercase email. Keep status/source filtering server-side.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-leads.test.ts
```

Expected: FAIL for missing search/page/duplicate fields.

**Step 3: Implement the bounded launch-scale query**

At first-client scale, fetch at most 500 matching rows from each lead source,
normalize them, sort newest-first, compute duplicate keys, and slice a 50-row
page. Reject page values below 1 and clamp pages beyond the result count.

**Step 4: Update the page**

Add a labelled search field, preserve status/source in links, show Previous/Next
with total count, and add a non-color "Duplicate details" badge with a count.
Keep email and WhatsApp links explicit and safe (`rel="noreferrer"`).

**Step 5: Run tests and lint**

Run:

```bash
npx vitest run tests/admin-leads.test.ts
npx eslint src/modules/admin/leads.ts src/app/admin/leads
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/modules/admin/leads.ts src/app/admin/leads tests/admin-leads.test.ts
git commit -m "feat(admin): make founder leads easier to work"
```

### Task 9: Add a real cron heartbeat and operation severity

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/cron/process-queue/route.ts`
- Create: `src/modules/admin/health.ts`
- Modify: `src/modules/admin/ops.ts`
- Modify: `src/app/admin/ops/page.tsx`
- Modify: `scripts/enable-rls.ts` only if the script uses an explicit table list
- Modify: `tests/admin-ops.test.ts`
- Create: `tests/admin-heartbeat.test.ts`

**Step 1: Write failing classification tests**

Use explicit thresholds:

```ts
expect(classifyHeartbeat(nowMinusMinutes(4), now)).toBe("healthy");
expect(classifyHeartbeat(nowMinusMinutes(12), now)).toBe("degraded");
expect(classifyHeartbeat(nowMinusMinutes(31), now)).toBe("critical");
expect(classifyHeartbeat(null, now)).toBe("unknown");
```

Test overall severity ordering `critical > degraded > healthy`, and test that
queue rows older than 15 minutes and dead/failed work contribute incidents.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-ops.test.ts tests/admin-heartbeat.test.ts
```

Expected: FAIL because the classifier/model do not exist.

**Step 3: Add the heartbeat model**

Add an admin-only platform table:

```prisma
model SystemHeartbeat {
  key        String   @id
  status     String   @default("ok")
  detail     Json     @default("{}")
  lastSeenAt DateTime @updatedAt
  createdAt  DateTime @default(now())
}
```

The cron route upserts `key: "process-queue"` only after all steps complete,
with bounded numeric summary data in `detail`. If a step throws, the route must
upsert `status: "error"` with a safe step label—not a stack, payload, token, or
message body—then rethrow/return 500.

**Step 4: Expand operational reads**

`opsOverview` should return:

- heartbeat and severity;
- queued campaign messages older than 15 minutes, grouped by campaign/org;
- failed campaign messages grouped by campaign/org with consent-safe retry
  metadata;
- dead CRM jobs with event/provider/org, but not payload;
- existing webhook failures, stale/rejected templates, and cost alerts.

Never select `Message` contact data, message bodies, webhook secret, CRM payload,
or integration credentials.

**Step 5: Update the operations page**

Show one explicit state banner, freshness, incident counts, and recovery paths.
Use text/icon/status labels so severity is not color-only. Replace the current
uninterpreted activity timestamps with separate activity metadata below the
real cron heartbeat.

**Step 6: Generate and test locally**

Run:

```bash
npx prisma generate
npx vitest run tests/admin-ops.test.ts tests/admin-heartbeat.test.ts
npx tsc --noEmit
```

Expected: pass.

**Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/api/cron/process-queue/route.ts src/modules/admin/health.ts src/modules/admin/ops.ts src/app/admin/ops/page.tsx tests/admin-ops.test.ts tests/admin-heartbeat.test.ts scripts/enable-rls.ts
git commit -m "feat(admin): add truthful platform health monitoring"
```

### Task 10: Add only proven-safe recovery actions

**Files:**
- Create: `src/app/admin/ops/actions.ts`
- Modify: `src/modules/admin/ops.ts`
- Modify: `src/modules/admin/audit.ts`
- Modify: `src/modules/orgs/audit.ts`
- Modify: `src/app/admin/ops/page.tsx`
- Create: `tests/admin-recovery.test.ts`

**Step 1: Write retry-eligibility tests**

Campaign retry is allowed only through the existing `retryFailedMessages`,
which rechecks consent and plan limits. CRM retry is allowed only for events
whose provider operation is idempotent (`contact.created` upsert and
`lead.qualified` stage update); activity-log events remain diagnostic-only.
Template refresh is allowed only for a pending campaign-less template that
belongs to the selected organization.

Test cross-org IDs, already-completed records, unsafe CRM event kinds, suspended
organizations, and duplicate invocation.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-recovery.test.ts
```

Expected: FAIL because recovery functions/actions do not exist.

**Step 3: Implement module recovery functions**

- Campaign: call `retryFailedMessages(campaignId, orgId)` and preserve its
  double consent gate.
- CRM: claim one dead eligible job with `updateMany({ where: { id, orgId,
  status: "dead" }, data: { status: "pending", attempts: 0, error: null,
  nextRunAt: new Date() } })`; success requires `count === 1`.
- Template: load `{ id, orgId, campaignId, metaStatus }`, require
  `campaignId === null && metaStatus === "PENDING"`, then call
  `refreshLibraryTemplateStatus(id, orgId)`.

Wrap external/multi-step operations with `admin.operation_requested`,
`admin.operation_completed`, or `admin.operation_failed` audit rows. The failed
detail is a stable error category, never raw provider text containing secrets.

**Step 4: Add route actions and UI**

Every recovery action uses `runFounderAction`, requires a reason and confirmation,
shows the precise scope, and revalidates `/admin/ops` plus the affected org.
Unsafe records show an explanation instead of a disabled unlabeled button.

**Step 5: Run recovery and invariant tests**

Run:

```bash
npx vitest run tests/admin-recovery.test.ts tests/consent.test.ts tests/send-payload.test.ts tests/admin-suspension.test.ts
```

Expected: pass; no recovery path bypasses consent or suspension.

**Step 6: Commit**

```bash
git add src/app/admin/ops/actions.ts src/app/admin/ops/page.tsx src/modules/admin/ops.ts src/modules/admin/audit.ts src/modules/orgs/audit.ts tests/admin-recovery.test.ts
git commit -m "feat(admin): add scoped operational recovery"
```

### Task 11: Improve demand filters and exact chart alternatives

**Files:**
- Modify: `src/modules/admin/events.ts`
- Modify: `src/app/admin/events/page.tsx`
- Modify: `tests/admin-events.test.ts`

**Step 1: Write failing filter tests**

Test date-range parsing plus optional event type, organization, and vertical.
Assert the Prisma query applies the same where-clause to totals, series, and
recent rows. Assert no `props` or conversation/message fields are selected.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-events.test.ts
```

Expected: FAIL for missing filters.

**Step 3: Implement query and UI filters**

Add a pure `eventsWhere(filter, since)` builder. Expose event type and vertical
options from the already-aggregated result; use the global organization search
to reach a specific org rather than loading an unbounded org select.

Add a compact exact-value table below the visual series. The chart's accessible
summary states the highest-volume day/type and total; hover is not the only way
to obtain values.

**Step 4: Run tests and lint**

Run:

```bash
npx vitest run tests/admin-events.test.ts
npx eslint src/modules/admin/events.ts src/app/admin/events/page.tsx
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/modules/admin/events.ts src/app/admin/events/page.tsx tests/admin-events.test.ts
git commit -m "feat(admin): make demand telemetry explorable"
```

### Task 12: Expand audit filtering, details, and CSV export

**Files:**
- Modify: `src/modules/admin/audit-log.ts`
- Modify: `src/components/features/admin-shell/audit-table.tsx`
- Modify: `src/app/admin/audit/page.tsx`
- Create: `src/app/admin/audit/export/route.ts`
- Create: `tests/admin-audit-log.test.ts`
- Create: `tests/admin-audit-export.test.ts`

**Step 1: Write failing audit filter/export tests**

Test organization, actor, action prefix, date-from/date-to, and derived result:
`requested` for `*.requested`, `failed` for `*.failed`, and `completed` for other
actions. Test CSV formula-injection escaping for values beginning with `=`, `+`,
`-`, or `@`; enforce a 10,000-row export cap.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-audit-log.test.ts tests/admin-audit-export.test.ts
```

Expected: FAIL because filters/export do not exist.

**Step 3: Implement reusable filtering and CSV serialization**

Keep `auditList` paginated. Add `auditExportRows` with the same where builder and
a strict select of actor/action/target/detail/time/org name. Implement a pure
`csvCell` that quotes values and prefixes formula-like text with `'`.

The route calls `requireFounder` before querying and returns:

```ts
return new Response(csv, {
  headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="nudge-admin-audit-${date}.csv"`,
    "cache-control": "no-store",
  },
});
```

**Step 4: Make table details accessible**

Replace hover-only truncated details with `<details><summary>…</summary>…</details>`
or an equivalent keyboard-accessible disclosure. Keep the compact first line.
Add filters and an Export CSV link that preserves them.

**Step 5: Run tests and lint**

Run:

```bash
npx vitest run tests/admin-audit-log.test.ts tests/admin-audit-export.test.ts tests/admin-gate.test.ts
npx eslint src/modules/admin/audit-log.ts src/components/features/admin-shell/audit-table.tsx src/app/admin/audit
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/modules/admin/audit-log.ts src/components/features/admin-shell/audit-table.tsx src/app/admin/audit tests/admin-audit-log.test.ts tests/admin-audit-export.test.ts
git commit -m "feat(admin): improve incident audit review"
```

### Task 13: Add admin-native loading, error recovery, and responsive polish

**Files:**
- Create: `src/app/admin/loading.tsx`
- Create: `src/app/admin/error.tsx`
- Create: `src/app/admin/orgs/[id]/loading.tsx`
- Modify: `src/components/features/admin-shell/admin-shell.tsx`
- Modify: `src/components/features/admin-shell/org-tabs.tsx`
- Modify: `src/components/features/admin-shell/action-form.tsx`
- Modify: `src/app/admin/orgs/[id]/layout.tsx`
- Create: `tests/admin-ui-contract.test.ts`

**Step 1: Write UI contract tests**

Without adding a DOM-test dependency, verify exported pure helpers and source
contracts for:

- admin error recovery links to `/admin`, never `/dashboard`;
- loading states use `aria-busy` and stable skeleton geometry;
- admin main has an ID and skip link;
- mobile navigation labels and dialog semantics remain present;
- organization tabs use the approved labels;
- charts and statuses expose text alternatives;
- clickable controls use at least 44-pixel heights at small breakpoints.

Prefer testing extracted constants/helpers over broad snapshots.

**Step 2: Run to verify failure**

Run:

```bash
npx vitest run tests/admin-ui-contract.test.ts
```

Expected: FAIL because admin boundaries/approved labels are missing.

**Step 3: Implement boundaries and navigation polish**

Adapt the existing app error/loading components to admin context. The error
boundary shows a safe digest reference, Try again, and Back to admin. Add a
keyboard-visible skip link targeting `<main id="admin-main">`. Rename org tabs
to Setup & Front Desk and Activity while keeping existing URLs stable.

Preserve the official Nudge logo and current brand palette. Use Nudge green for
brand/positive state, neutral surfaces, amber for attention, red for danger.
Do not adopt the generic blue palette suggested by the design database.

**Step 4: Validate UI guidance**

Run:

```bash
python3 /Users/visheshjain/.agents/skills/ui-ux-pro-max/scripts/search.py "admin dashboard accessibility loading responsive tables keyboard" --domain ux
npx vitest run tests/admin-ui-contract.test.ts
npx eslint src/app/admin src/components/features/admin-shell
```

Expected: tests/lint pass and the implementation satisfies the applicable
accessibility checklist.

**Step 5: Commit**

```bash
git add src/app/admin src/components/features/admin-shell tests/admin-ui-contract.test.ts
git commit -m "feat(admin): polish founder control room UX"
```

### Task 14: Roll out the additive heartbeat table and verify end-to-end

**Files:**
- Modify: `docs/TESTING_ENTERPRISE.md`
- Modify: `PROGRESS.md`
- Modify: `docs/plans/2026-09-08-founder-control-room-design.md` status only if
  implementation fully matches it
- Modify: `docs/plans/2026-09-08-founder-control-room-implementation.md` status
  notes only

**Step 1: Inspect schema rollout before applying it**

Run:

```bash
npx prisma validate
npx prisma db push --accept-data-loss=false
```

Expected: only additive creation of `SystemHeartbeat`; no destructive warning.
If Prisma reports any destructive operation, stop and investigate rather than
using `--accept-data-loss`.

**Step 2: Re-enable RLS**

Run:

```bash
npm run db:rls
```

Expected: all public tables, including `SystemHeartbeat`, have RLS enabled and
no publishable-key policy is added.

**Step 3: Run the complete automated verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: every test passes, ESLint exits 0, production build exits 0.

**Step 4: Run an authenticated simulation-only browser walkthrough**

Start the app in the worktree on an unused port and verify:

1. Non-founder access produces a 404 in automated auth tests.
2. Founder overview loads and every attention item has a valid destination.
3. Organization search, filters, sort, pagination, and mobile rows work.
4. A simulated org missing WhatsApp is Blocked, never Ready.
5. Every organization tab loads without console/runtime errors.
6. Routine form feedback, confirmation dialogs, typed confirmation, and error
   recovery are keyboard-operable.
7. Leads search/duplicates/pagination work.
8. Operations severity and safe retry eligibility render correctly.
9. Audit filters, detail disclosure, and CSV export work.
10. At 375, 768, 1024, and 1440 CSS pixels there is no page-level horizontal
    overflow and no control is hidden behind sticky navigation.

Do not execute a live-mode, suspension, ownership-transfer, disconnect, key
revocation, or outbound retry against a real organization during this pass.

**Step 5: Update documentation**

Document exact founder login requirements, simulation test steps, critical
action safeguards, the heartbeat rollout, and the final verification totals in
`docs/TESTING_ENTERPRISE.md` and `PROGRESS.md`.

**Step 6: Commit**

```bash
git add docs/TESTING_ENTERPRISE.md PROGRESS.md docs/plans/2026-09-08-founder-control-room-design.md docs/plans/2026-09-08-founder-control-room-implementation.md
git commit -m "docs(admin): record founder control room verification"
```

### Task 15: Review and integrate safely

**Files:**
- Verify only: branch diff and Git history

**Step 1: Review scope**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: only approved admin, shared readiness/audit, additive heartbeat, tests,
and documentation changes; no landing media or unrelated marketing edits.

**Step 2: Re-run the protected-invariant tests**

Run:

```bash
npx vitest run tests/consent.test.ts tests/send-payload.test.ts tests/template-payload.test.ts tests/model-guard.test.ts tests/org-scope.test.ts tests/roles.test.ts tests/admin-suspension.test.ts
```

Expected: pass.

**Step 3: Integrate using the branch-finishing workflow**

Use `superpowers:requesting-code-review`, then
`superpowers:verification-before-completion`, then
`superpowers:finishing-a-development-branch`. Do not merge or push until review
and the final verification are green.

