# Founder WhatsApp Connection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an authenticated Nudge founder validate and securely save a client's official Meta WhatsApp Cloud API number from the organization's founder portal without changing the workspace's send mode.

**Architecture:** A founder-only Server Action delegates to the admin integrations service. That service checks the target organization and required reason, validates the WABA/token/phone relationship through a dedicated official-Meta validator (or deterministic simulation), reuses encrypted account persistence with a preserve-mode option, and records a redacted founder audit event. The existing admin integrations page hosts the form and the existing account controls remain unchanged.

**Tech Stack:** Next.js 16 App Router, React Server Components and Server Actions, TypeScript, Prisma/Postgres, Tailwind CSS, Vitest.

---

## Task 1: Add Meta connection validation

**Files:**

- Create: `src/modules/whatsapp/connection-validator.ts`
- Create: `tests/whatsapp-connection-validator.test.ts`

### Step 1: Write failing validator tests

Cover:

- malformed WABA, Phone Number ID, display name, and token inputs;
- simulation mode succeeds without calling `fetch`;
- a live Meta response containing the Phone Number ID succeeds;
- rejected credentials produce a stable safe message;
- a number absent from the WABA produces a mismatch message;
- network and malformed Meta responses produce a retryable safe message.

### Step 2: Run the focused tests and confirm RED

Run: `npm test -- tests/whatsapp-connection-validator.test.ts`

Expected: fail because the validator module does not exist.

### Step 3: Implement the minimum validator

Add bounded input normalization and query the official Graph API endpoint:

`/{WABA_ID}/phone_numbers?fields=id&limit=100`

Use the configured WhatsApp API version, a bearer token, a finite timeout, and
stable errors. Never include the token or raw Meta response in thrown errors.
Skip the network in simulation mode after local validation.

### Step 4: Run focused tests and confirm GREEN

Run: `npm test -- tests/whatsapp-connection-validator.test.ts`

### Step 5: Commit

```bash
git add src/modules/whatsapp/connection-validator.ts tests/whatsapp-connection-validator.test.ts
git commit -m "feat(whatsapp): validate founder number connections"
```

## Task 2: Preserve send mode during founder credential setup

**Files:**

- Modify: `src/modules/whatsapp/accounts.ts`
- Modify: `tests/whatsapp-accounts.test.ts`

### Step 1: Write a failing account test

Call `saveWhatsappAccount` with an option that preserves the organization's send
mode. Assert that the account is still upserted and `prisma.org.update` is not
called.

### Step 2: Run the focused test and confirm RED

Run: `npm test -- tests/whatsapp-accounts.test.ts`

Expected: fail because the persistence option is not supported.

### Step 3: Implement the minimum option

Add an optional `activateOrg` setting that defaults to the existing behavior.
Only set `org.simulated = false` when that setting is true. This preserves every
existing caller while allowing the founder flow to leave mode unchanged.

### Step 4: Run focused tests and confirm GREEN

Run: `npm test -- tests/whatsapp-accounts.test.ts`

### Step 5: Commit

```bash
git add src/modules/whatsapp/accounts.ts tests/whatsapp-accounts.test.ts
git commit -m "feat(whatsapp): preserve mode during assisted setup"
```

## Task 3: Add founder orchestration and audit

**Files:**

- Modify: `src/modules/admin/integrations.ts`
- Modify: `tests/admin-integrations-safety.test.ts`

### Step 1: Write failing service tests

Cover:

- a reason is required before validation;
- a missing organization is rejected before Meta validation;
- validation failure saves nothing and writes no audit;
- success saves with `activateOrg: false` and writes an awaited
  `admin.integration_changed` audit event;
- audit detail contains the IDs and reason but never the access token;
- persistence failure does not write a success audit event.

### Step 2: Run the focused tests and confirm RED

Run: `npm test -- tests/admin-integrations-safety.test.ts`

### Step 3: Implement the service function

Add `founderConnectWhatsapp`. Use the existing confirmation helpers, account
module, and founder audit helper. Keep all errors safe for the UI and never log
credentials.

### Step 4: Run focused tests and confirm GREEN

Run: `npm test -- tests/admin-integrations-safety.test.ts`

### Step 5: Commit

```bash
git add src/modules/admin/integrations.ts tests/admin-integrations-safety.test.ts
git commit -m "feat(admin): connect WhatsApp numbers for clients"
```

## Task 4: Wire the founder Server Action and UI

**Files:**

- Modify: `src/app/admin/orgs/[id]/actions.ts`
- Modify: `src/app/admin/orgs/[id]/integrations/page.tsx`
- Modify: `tests/admin-actions.test.ts`
- Create: `tests/admin-integrations-page.test.tsx`

### Step 1: Write failing action and UI tests

Assert that:

- the Server Action maps all form fields, enters the founder action wrapper, and
  forwards the required reason;
- the page renders the four setup fields;
- the token field is `type="password"`;
- the form uses a confirmation and required-reason interaction;
- the page explains that connecting does not enable live mode.

### Step 2: Run the focused tests and confirm RED

Run:

`npm test -- tests/admin-actions.test.ts tests/admin-integrations-page.test.tsx`

### Step 3: Implement the Server Action

Add a thin `connectWhatsappAction` using `runFounderAction`, the existing reason
helper, the new admin service, and route revalidation.

### Step 4: Implement the form

Add a “Connect a number” panel to the existing WhatsApp integration section.
Reuse `ActionForm` and current field styles. Keep the access token uncontrolled,
masked, and out of page state. Make update semantics and live-mode separation
clear in concise copy.

### Step 5: Run focused tests and confirm GREEN

Run:

`npm test -- tests/admin-actions.test.ts tests/admin-integrations-page.test.tsx`

### Step 6: Commit

```bash
git add src/app/admin/orgs/[id]/actions.ts src/app/admin/orgs/[id]/integrations/page.tsx tests/admin-actions.test.ts tests/admin-integrations-page.test.tsx
git commit -m "feat(admin): add client WhatsApp connection form"
```

## Task 5: Verify, document, and integrate

**Files:**

- Modify: `PROGRESS.md`

### Step 1: Run focused safety regression tests

Run:

`npm test -- tests/whatsapp-connection-validator.test.ts tests/whatsapp-accounts.test.ts tests/admin-integrations-safety.test.ts tests/admin-actions.test.ts tests/admin-integrations-page.test.tsx`

### Step 2: Run full verification

Run:

- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Step 3: Update progress

Record the founder-only setup flow, simulation behavior, encrypted storage,
audit coverage, and exact verification results in `PROGRESS.md`.

### Step 4: Commit the progress record

```bash
git add PROGRESS.md
git commit -m "docs(progress): record founder WhatsApp setup"
```

### Step 5: Review and integrate

Review the branch diff for secret handling, tenant scoping, and accidental mode
changes. Merge the verified branch into local `main` without touching unrelated
working-tree files, then repeat the relevant verification on the merged result.
