# Free Trial Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the secure acquisition-trial data model, closed-signup claim path, server-enforced capabilities, bounded knowledge setup, and concurrency-safe 15-reply allowance.

**Architecture:** A platform-level `AcquisitionTrial` begins before authentication and links one-to-one to the existing `Org` after a signed-up user proves a short-lived claim token. `src/modules/trial/` owns all trial state and quotas; existing auth, knowledge, agent, inbox, and billing modules call that boundary rather than duplicating trial rules.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma/Postgres, Supabase Auth, Zod, Vitest

**Spec:** `docs/plans/2026-09-20-free-trial-funnel-design.md`

## Global Constraints

- The acquisition trial ends after exactly seven days or 15 AI-generated replies, whichever comes first.
- `SIGNUP_OPEN` remains closed; only a valid invite, founder-created owner setup, or valid unclaimed acquisition-trial token may create/join a workspace.
- Every acquisition-trial workspace stays in simulation mode and cannot connect or send through real WhatsApp.
- The trial is not a permanent free plan and does not change Entry/Starter/Growth/Pro prices or entitlements.
- All model calls continue through `src/lib/model-router`; never add a direct provider call.
- Trial replies use only approved org-scoped knowledge and the existing agent path.
- All new platform tables have RLS enabled with no browser policies.
- Consent to trial/demo contact is not customer marketing opt-in.
- Preserve the existing invitation, closed-signup, tenant-isolation, consent, 24-hour-window, and simulation tests.
- Do not edit or stage unrelated worktree changes.

## Review Focus

- Malformed, stale, mismatched, or replayed auth metadata must never create an org; Task 3 tests each claim failure.
- Two concurrent claims for the same pending trial must create at most one org; Task 3 pins the transaction/update count.
- Two simultaneous sends at reply 14 must produce at most reply 15; Task 6 tests the atomic conditional increment.
- Failed/empty knowledge ingestion must not consume the one trial source; Task 5 tests reserve, release, and successful commit.
- A direct call to a paid mutation must remain blocked even if its page is hidden; Task 4 tests zero WhatsApp/campaign/automation/action capability.

---

### Task 1: Trial schema and pure state model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/modules/trial/state.ts`
- Create: `tests/trial-state.test.ts`

**Interfaces:**
- Produces: `TRIAL_DAYS`, `TRIAL_REPLY_LIMIT`, `TrialStatus`, `TrialStateInput`, `deriveTrialStatus(input, now)`, and `trialEndsAt(startedAt)`.
- Consumes: no application services; state derivation remains pure.

- [ ] **Step 1: Write the failing state tests**

```ts
import { describe, expect, it } from "vitest";
import {
  TRIAL_DAYS,
  TRIAL_REPLY_LIMIT,
  deriveTrialStatus,
  trialEndsAt,
} from "@/modules/trial/state";

const now = new Date("2026-09-20T00:00:00Z");
const base = {
  orgId: "org_1",
  claimedAt: now,
  startedAt: now,
  expiresAt: new Date("2026-09-27T00:00:00Z"),
  repliesUsed: 0,
  replyLimit: 15,
  convertedAt: null,
  subscriptionStatus: "inactive",
};

describe("acquisition trial state", () => {
  it("uses the approved seven-day and 15-reply contract", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(TRIAL_REPLY_LIMIT).toBe(15);
    expect(trialEndsAt(now).toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("distinguishes pending, active, exhausted, expired and converted", () => {
    expect(deriveTrialStatus({ ...base, orgId: null }, now)).toBe("pending");
    expect(deriveTrialStatus(base, now)).toBe("active");
    expect(deriveTrialStatus({ ...base, repliesUsed: 15 }, now)).toBe("exhausted");
    expect(deriveTrialStatus(base, new Date("2026-09-27T00:00:00Z"))).toBe("expired");
    expect(deriveTrialStatus({ ...base, convertedAt: now }, now)).toBe("converted");
    expect(deriveTrialStatus({ ...base, subscriptionStatus: "active" }, now)).toBe("converted");
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npx vitest run tests/trial-state.test.ts`

Expected: FAIL because `@/modules/trial/state` does not exist.

- [ ] **Step 3: Add the Prisma models and relations**

Add `acquisitionTrial AcquisitionTrial?` beside the other `Org` relations. Add
the following fields and index to `DemoBooking` without replacing its current
fields or indexes:

```prisma
acquisitionTrialId String?
acquisitionTrial   AcquisitionTrial? @relation(fields: [acquisitionTrialId], references: [id], onDelete: SetNull)

@@index([acquisitionTrialId])
```

Then add the two models near the existing platform lead models:

```prisma
model AcquisitionTrial {
  id                        String    @id @default(cuid())
  orgId                     String?   @unique
  org                       Org?      @relation(fields: [orgId], references: [id], onDelete: SetNull)
  ownerName                 String
  businessName              String
  email                     String
  emailNormalized           String    @unique
  phoneE164                 String    @unique
  contactConsentAt          DateTime
  claimTokenHash            String    @unique
  claimExpiresAt            DateTime
  claimedAt                 DateTime?
  startedAt                 DateTime?
  expiresAt                 DateTime?
  replyLimit                Int       @default(15)
  repliesUsed               Int       @default(0)
  knowledgeSource           String?
  knowledgeSourceUsedAt     DateTime?
  tourStep                  String    @default("welcome")
  tourCompletedAt           DateTime?
  tourDismissedAt           DateTime?
  firstReplyAt              DateTime?
  exploreViewedAt           DateTime?
  exhaustedAt               DateTime?
  expiredAt                 DateTime?
  demoClickedAt             DateTime?
  demoBookedAt              DateTime?
  checkoutClickedAt         DateTime?
  convertedAt               DateTime?
  landingPath               String    @default("/free-trial")
  referrer                  String?
  utmSource                 String?
  utmMedium                 String?
  utmCampaign               String?
  gaClientId                String?
  source                    String    @default("free-trial")
  leadStatus                String    @default("new")
  founderNotes              String?
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt
  events                    AcquisitionTrialEvent[]
  demoBookings              DemoBooking[]

  @@index([leadStatus, createdAt])
  @@index([expiresAt])
}

model AcquisitionTrialEvent {
  id        String           @id @default(cuid())
  trialId   String
  trial     AcquisitionTrial @relation(fields: [trialId], references: [id], onDelete: Cascade)
  orgId     String?
  name      String
  props     Json             @default("{}")
  createdAt DateTime         @default(now())

  @@index([trialId, createdAt])
  @@index([name, createdAt])
}
```

- [ ] **Step 4: Implement the pure state module**

```ts
export const TRIAL_DAYS = 7;
export const TRIAL_REPLY_LIMIT = 15;
const DAY_MS = 86_400_000;

export type TrialStatus =
  | "pending"
  | "active"
  | "exhausted"
  | "expired"
  | "converted";

export interface TrialStateInput {
  orgId: string | null;
  claimedAt: Date | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  repliesUsed: number;
  replyLimit: number;
  convertedAt: Date | null;
  subscriptionStatus: string;
}

export function trialEndsAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS);
}

export function deriveTrialStatus(
  input: TrialStateInput,
  now: Date = new Date()
): TrialStatus {
  if (input.convertedAt || input.subscriptionStatus === "active") return "converted";
  if (!input.orgId || !input.claimedAt || !input.startedAt || !input.expiresAt) return "pending";
  if (now.getTime() >= input.expiresAt.getTime()) return "expired";
  if (input.repliesUsed >= input.replyLimit) return "exhausted";
  return "active";
}
```

- [ ] **Step 5: Format/generate Prisma and run the test**

Run: `npx prisma format && npx prisma generate && npx vitest run tests/trial-state.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the schema and pure state**

```bash
git add prisma/schema.prisma src/modules/trial/state.ts tests/trial-state.test.ts
git commit -m "feat(trial): add acquisition trial state"
```

### Task 2: Public trial intake and claim-token creation

**Files:**
- Create: `src/modules/trial/signup.ts`
- Create: `src/app/api/trials/route.ts`
- Modify: `src/lib/supabase/proxy-session.ts`
- Create: `tests/trial-signup.test.ts`

**Interfaces:**
- Consumes: `normalizePhoneE164`, `checkRateLimit`, `RATE_LIMITS.publicForm`, `prisma.acquisitionTrial`.
- Produces: `trialSignupSchema`, `createPendingTrial(input, now?) -> Promise<{ trialId; claimToken }>`, and public `POST /api/trials`.

- [ ] **Step 1: Write failing validation and token tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { acquisitionTrial: { create } } }));

import {
  createPendingTrial,
  trialSignupSchema,
  hashClaimToken,
} from "@/modules/trial/signup";

describe("trial signup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires explicit contact consent and an international phone", () => {
    expect(trialSignupSchema.safeParse({
      ownerName: "Asha",
      businessName: "Aster Clinic",
      email: "owner@aster.in",
      phone: "9876500000",
      contactConsent: false,
    }).success).toBe(false);
  });

  it("stores normalized contact data and only the token hash", async () => {
    create.mockResolvedValue({ id: "trial_1" });
    const result = await createPendingTrial({
      ownerName: " Asha ",
      businessName: " Aster Clinic ",
      email: "Owner@Aster.IN",
      phone: "+919876500000",
      contactConsent: true,
      attribution: { landingPath: "/free-trial", utmSource: "meta" },
    }, new Date("2026-09-20T00:00:00Z"));

    expect(result.claimToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      emailNormalized: "owner@aster.in",
      phoneE164: "+919876500000",
      claimTokenHash: hashClaimToken(result.claimToken),
      utmSource: "meta",
    }) });
    expect(JSON.stringify(create.mock.calls[0])).not.toContain(result.claimToken);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run tests/trial-signup.test.ts`

Expected: FAIL because the signup module is missing.

- [ ] **Step 3: Implement normalized input and hashed tokens**

```ts
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";

const safeOptional = z.string().trim().max(200).optional();
export const trialSignupSchema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(24),
  contactConsent: z.literal(true),
  honeypot: z.string().max(0).optional(),
  attribution: z.object({
    landingPath: z.string().startsWith("/").max(200).default("/free-trial"),
    referrer: safeOptional,
    utmSource: safeOptional,
    utmMedium: safeOptional,
    utmCampaign: safeOptional,
    gaClientId: z.string().max(64).optional(),
  }).default({ landingPath: "/free-trial" }),
});

export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPendingTrial(
  raw: z.input<typeof trialSignupSchema>,
  now = new Date()
) {
  const input = trialSignupSchema.parse(raw);
  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164 || !input.phone.startsWith("+")) {
    throw new Error("Enter the mobile number with its country code.");
  }
  const claimToken = randomBytes(32).toString("base64url");
  const row = await prisma.acquisitionTrial.create({
    data: {
      ownerName: input.ownerName,
      businessName: input.businessName,
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
      phoneE164,
      contactConsentAt: now,
      claimTokenHash: hashClaimToken(claimToken),
      claimExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      landingPath: input.attribution.landingPath,
      referrer: input.attribution.referrer,
      utmSource: input.attribution.utmSource,
      utmMedium: input.attribution.utmMedium,
      utmCampaign: input.attribution.utmCampaign,
      gaClientId: input.attribution.gaClientId,
    },
  });
  return { trialId: row.id, claimToken };
}

```

- [ ] **Step 4: Add the public API route with rate limiting and duplicate-safe errors**

```ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPendingTrial, trialSignupSchema } from "@/modules/trial/signup";

export async function POST(request: Request) {
  const ip = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const rate = checkRateLimit(`trial-signup:${ip}`, RATE_LIMITS.publicForm);
  if (!rate.allowed) return NextResponse.json(
    { ok: false, error: "Too many attempts — try again in a minute." },
    { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
  );
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  const parsed = trialSignupSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json(
    { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." },
    { status: 400 }
  );
  try {
    const claim = await createPendingTrial(parsed.data);
    return NextResponse.json({ ok: true, claim });
  } catch (error) {
    const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    return NextResponse.json(
      { ok: false, error: duplicate
        ? "A trial already exists for that email or mobile. Sign in to resume it."
        : error instanceof Error ? error.message : "Couldn't start the trial." },
      { status: duplicate ? 409 : 500 }
    );
  }
}
```

Add `"/api/trials"` to `PUBLIC_PATH_PREFIXES` in `src/lib/supabase/proxy-session.ts`.

- [ ] **Step 5: Test the route contract and public-path classification**

Extend `tests/trial-signup.test.ts` with a route POST test that expects 400 for malformed JSON, 429 for a denied rate limit, 409 for Prisma `P2002`, and verifies the response never contains `claimTokenHash`. Add this assertion to `tests/proxy-session.test.ts`:

```ts
expect(isPublicPath("/api/trials")).toBe(true);
expect(isPublicPath("/trial/setup")).toBe(false);
```

Run: `npx vitest run tests/trial-signup.test.ts tests/proxy-session.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit public trial intake**

```bash
git add src/modules/trial/signup.ts src/app/api/trials/route.ts src/lib/supabase/proxy-session.ts tests/trial-signup.test.ts tests/proxy-session.test.ts
git commit -m "feat(trial): accept secure trial signups"
```

### Task 3: Claim a pending trial without opening global signup

**Files:**
- Create: `src/modules/trial/claim.ts`
- Modify: `src/modules/orgs/org.ts`
- Modify: `src/modules/orgs/auth.ts`
- Modify: `tests/signup-closed.test.ts`
- Create: `tests/trial-claim.test.ts`

**Interfaces:**
- Consumes: auth `userId`, verified auth email, untrusted `user_metadata`, Prisma transaction, `trialGrant`.
- Produces: `parseTrialClaimMetadata(raw)`, `claimAcquisitionTrial(input) -> ResolvedOrg | null`, and optional `trialClaim` input on `resolveOrgContext`.

- [ ] **Step 1: Write claim-security tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { hashClaimToken } from "@/modules/trial/signup";
import { parseTrialClaimMetadata } from "@/modules/trial/claim";

describe("trial claim metadata", () => {
  it("accepts only bounded opaque ids and tokens", () => {
    expect(parseTrialClaimMetadata({
      acquisition_trial_id: "trial_123",
      acquisition_trial_token: "a".repeat(43),
    })).toEqual({ trialId: "trial_123", claimToken: "a".repeat(43) });
    expect(parseTrialClaimMetadata({ acquisition_trial_id: "../x", acquisition_trial_token: "short" })).toBeNull();
  });

  it("hashes the presented token before querying", () => {
    expect(hashClaimToken("a".repeat(43))).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

Add mocked-transaction cases that assert expired token, wrong email, already
claimed token, and `updateMany.count === 0` return no workspace. Add one success
case that asserts `Org.simulated === true`, `plan === "free"`, OWNER membership,
seven-day `trialEndsAt`, and a 100-credit `trialGrant` expiring at the same time.

- [ ] **Step 2: Run the tests and confirm failure**

Run: `npx vitest run tests/trial-claim.test.ts tests/signup-closed.test.ts`

Expected: FAIL because trial claims are not resolved.

- [ ] **Step 3: Implement bounded metadata parsing and transactional claim**

```ts
import type { Membership, Org, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { trialGrant } from "@/modules/billing/credits";
import { hashClaimToken } from "./signup";
import { trialEndsAt } from "./state";

export type TrialClaim = { trialId: string; claimToken: string };

export function parseTrialClaimMetadata(raw: unknown): TrialClaim | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const trialId = value.acquisition_trial_id;
  const claimToken = value.acquisition_trial_token;
  if (typeof trialId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(trialId)) return null;
  if (typeof claimToken !== "string" || !/^[A-Za-z0-9_-]{40,128}$/.test(claimToken)) return null;
  return { trialId, claimToken };
}

export async function claimAcquisitionTrial(input: {
  userId: string;
  email: string;
  claim: TrialClaim;
  now?: Date;
}): Promise<{ org: Org; membership: Membership } | null> {
  const now = input.now ?? new Date();
  const emailNormalized = input.email.trim().toLowerCase();
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const trial = await tx.acquisitionTrial.findFirst({
      where: {
        id: input.claim.trialId,
        claimTokenHash: hashClaimToken(input.claim.claimToken),
        emailNormalized,
        claimedAt: null,
        claimExpiresAt: { gt: now },
      },
    });
    if (!trial) return null;
    const expiresAt = trialEndsAt(now);
    const org = await tx.org.create({
      data: {
        ownerUserId: input.userId,
        name: trial.businessName,
        plan: "free",
        simulated: true,
        trialEndsAt: expiresAt,
        memberships: { create: {
          userId: input.userId,
          email: input.email,
          displayName: trial.ownerName,
          role: "OWNER",
        } },
        creditGrants: { create: trialGrant(expiresAt) },
      },
      include: { memberships: true },
    });
    const claimed = await tx.acquisitionTrial.updateMany({
      where: { id: trial.id, claimedAt: null },
      data: { orgId: org.id, claimedAt: now, startedAt: now, expiresAt },
    });
    if (claimed.count !== 1) throw new Error("Trial was already claimed.");
    const { memberships, ...orgRow } = org;
    return { org: orgRow, membership: memberships[0] };
  });
}
```

- [ ] **Step 4: Insert trial claim after invite resolution and before open signup**

Change the resolver signature and add this block after the invite branch:

```ts
export async function resolveOrgContext(
  userId: string,
  email?: string,
  options: { trialClaim?: TrialClaim | null } = {}
): Promise<ResolvedOrg> {
  // existing membership, owned org and invite branches stay first
  if (email && options.trialClaim) {
    const claimed = await claimAcquisitionTrial({
      userId,
      email,
      claim: options.trialClaim,
    });
    if (claimed) return claimed;
  }
  // existing SIGNUP_OPEN branch stays last
}
```

In `requireOrgContext`, pass only parsed auth metadata:

```ts
const trialClaim = parseTrialClaimMetadata(claims.user_metadata);
resolved = await resolveOrgContext(claims.sub, email, { trialClaim });
```

- [ ] **Step 5: Pin closed-signup and race behavior**

Update `tests/signup-closed.test.ts` so an uninvited account without a claim is
still rejected, invites still win over claim metadata, a valid claim is allowed,
and an invalid claim still reaches `NoWorkspaceError`. In the transaction mock,
make `updateMany` return `{ count: 0 }` on the second concurrent call and assert
that call rejects/rolls back rather than returning a second org.

Run: `npx vitest run tests/trial-claim.test.ts tests/signup-closed.test.ts tests/org-scope.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the closed-signup claim path**

```bash
git add src/modules/trial/claim.ts src/modules/orgs/org.ts src/modules/orgs/auth.ts tests/trial-claim.test.ts tests/signup-closed.test.ts
git commit -m "feat(trial): claim workspace without opening signup"
```

### Task 4: Restricted effective capabilities and mutation gates

**Files:**
- Create: `src/modules/trial/capabilities.ts`
- Modify: `src/modules/billing/limits.ts`
- Modify: `src/app/(app)/inbox/actions.ts`
- Modify: `src/app/api/integrations/crm/[provider]/start/route.ts`
- Modify: `src/app/api/integrations/crm/[provider]/callback/route.ts`
- Modify: `tests/plan-limits.test.ts`
- Create: `tests/trial-capabilities.test.ts`

**Interfaces:**
- Produces: `ACQUISITION_TRIAL_PLAN`, `isRestrictedAcquisitionTrial(orgId)`, and an effective plan returned by the existing billing limit checks.
- Consumes: acquisition-trial relation and `Org.subscriptionStatus`.

- [ ] **Step 1: Write failing capability tests**

```ts
import { describe, expect, it } from "vitest";
import { ACQUISITION_TRIAL_PLAN } from "@/modules/trial/capabilities";

describe("acquisition trial capabilities", () => {
  it("allows no paid or live mutation", () => {
    expect(ACQUISITION_TRIAL_PLAN.limits).toMatchObject({
      automations: 0,
      messagesPerMonth: 0,
      whatsappNumbers: 0,
      aiFrontDesk: false,
      publicApi: false,
      customActions: false,
      byoLlm: false,
      multiNumber: false,
      webWidget: false,
      leadScoring: false,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    });
  });
});
```

Add mocked `checkWhatsappNumbers`, `checkMessageLimit`, `checkAutomationLimit`,
and `checkAiFrontDesk` cases where `org.acquisitionTrial` exists and
`subscriptionStatus === "inactive"`; each must return `allowed: false`. Add a
paid-converted case that resolves the purchased plan instead.
In `tests/inbox.test.ts`, directly invoke suggest-reply and summarize actions
for an acquisition trial and assert neither reaches the model function.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-capabilities.test.ts tests/plan-limits.test.ts`

Expected: FAIL because limits ignore acquisition-trial state.

- [ ] **Step 3: Add the virtual restricted plan**

```ts
import type { Plan } from "@/modules/billing/plans";

export const ACQUISITION_TRIAL_PLAN: Plan = {
  id: "free",
  name: "Free trial",
  tagline: "A safe test workspace with 15 AI replies.",
  features: ["Business knowledge", "Simulated customer conversations"],
  includedCredits: 0,
  legacy: true,
  limits: {
    contacts: 1,
    teamMembers: 1,
    automations: 0,
    messagesPerMonth: 0,
    whatsappNumbers: 0,
    aiFrontDesk: false,
    publicApi: false,
    customActions: false,
    byoLlm: false,
    multiNumber: false,
    webWidget: false,
    leadScoring: false,
    voiceAgent: false,
    voiceMinutesPerMonth: 0,
  },
};

export async function isRestrictedAcquisitionTrial(orgId: string) {
  const row = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    select: {
      convertedAt: true,
      org: { select: { subscriptionStatus: true } },
    },
  });
  return Boolean(
    row && !row.convertedAt && row.org?.subscriptionStatus !== "active"
  );
}
```

Update the private `planFor` query in `billing/limits.ts`:

```ts
const org = await prisma.org.findUnique({
  where: { id: orgId },
  select: {
    plan: true,
    featureOverrides: true,
    subscriptionStatus: true,
    acquisitionTrial: { select: { id: true, convertedAt: true } },
  },
});
if (
  org?.acquisitionTrial &&
  !org.acquisitionTrial.convertedAt &&
  org.subscriptionStatus !== "active"
) return ACQUISITION_TRIAL_PLAN;
return applyFeatureOverrides(getPlan(org?.plan ?? "free"), org?.featureOverrides);
```

- [ ] **Step 4: Gate both CRM OAuth edges**

In the CRM start route, before signing state:

```ts
const gate = await checkAiFrontDesk(ctx.org.id);
if (!gate.allowed) {
  return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
}
```

In the callback, after `base` is derived and before exchanging the external
code:

```ts
const gate = await checkAiFrontDesk(verified.orgId);
if (!gate.allowed) {
  return NextResponse.redirect(`${base}/explore?feature=crm`, 307);
}
```

Calendar already uses `checkAiFrontDesk`; WhatsApp already uses
`checkWhatsappNumbers`; campaigns and automations already use the message and
automation checks. Add/import `checkAiFrontDesk` in both CRM routes.

At the start of `suggestReplyAction` and `summarizeConversationAction`, after
`requireOrgContext` and before rate limiting or a model call, return
`{ ok: false, message: "This AI tool is available on paid plans." }` when
`isRestrictedAcquisitionTrial(org.id)` is true. The trial's only model-backed
conversation doorway is `simulateInboundAction`, which Task 6 meters atomically.

- [ ] **Step 5: Run capability and protected-invariant tests**

Run: `npx vitest run tests/trial-capabilities.test.ts tests/plan-limits.test.ts tests/whatsapp-accounts.test.ts tests/campaign-guardrails.test.ts tests/automation.test.ts tests/crm-oauth-routes.test.ts tests/inbox.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit restricted capabilities**

```bash
git add src/modules/trial/capabilities.ts src/modules/billing/limits.ts src/app/'(app)'/inbox/actions.ts src/app/api/integrations/crm tests/trial-capabilities.test.ts tests/plan-limits.test.ts tests/crm-oauth-routes.test.ts tests/inbox.test.ts
git commit -m "feat(trial): lock paid and live capabilities"
```

### Task 5: Bounded knowledge-source allowance

**Files:**
- Create: `src/modules/trial/knowledge.ts`
- Modify: `src/modules/knowledge/ingest.ts`
- Modify: `src/app/(app)/agent/training-actions.ts`
- Modify: `src/app/(app)/agent/questionnaire/actions.ts`
- Create: `tests/trial-knowledge.test.ts`
- Modify: `tests/knowledge-ingest.test.ts`

**Interfaces:**
- Produces: `TRIAL_INTERVIEW_IDS`, `TRIAL_INGEST_BUDGET`, `withTrialKnowledgeSource(orgId, source, work, succeeded)`, and optional `IngestBudget` accepted by `ingestWebsite`.
- Consumes: `AcquisitionTrial.knowledgeSource` and `knowledgeSourceUsedAt`.

- [ ] **Step 1: Write failing allowance tests**

```ts
import { describe, expect, it, vi } from "vitest";
import {
  TRIAL_INGEST_BUDGET,
  TRIAL_INTERVIEW_IDS,
  withTrialKnowledgeSource,
} from "@/modules/trial/knowledge";

describe("trial knowledge budget", () => {
  it("uses the approved short interview and crawl budget", () => {
    expect(TRIAL_INTERVIEW_IDS).toEqual([
      "business_summary",
      "services_list",
      "hours_weekly",
      "location_address",
      "faq_1",
    ]);
    expect(TRIAL_INGEST_BUDGET).toEqual({ maxSubpages: 1, maxChunksPerPage: 2, maxDrafts: 25 });
  });

  it("releases a reserved source when work returns no facts", async () => {
    // mock updateMany: reserve succeeds, release succeeds
    const result = await withTrialKnowledgeSource("org_1", "website", async () => ({ drafts: 0 }), r => r.drafts > 0);
    expect(result).toEqual({ drafts: 0 });
    // assert the final update clears knowledgeSource when usedAt is still null
  });
});
```

Also test: paid/non-trial orgs bypass the allowance; one successful source sets
`knowledgeSourceUsedAt`; another source is rejected; a trial bulk questionnaire
silently accepts only the five approved ids.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-knowledge.test.ts tests/knowledge-ingest.test.ts`

Expected: FAIL because no trial knowledge budget exists.

- [ ] **Step 3: Implement reserve/commit/release**

```ts
export const TRIAL_INTERVIEW_IDS = [
  "business_summary",
  "services_list",
  "hours_weekly",
  "location_address",
  "faq_1",
] as const;

export const TRIAL_INGEST_BUDGET = {
  maxSubpages: 1,
  maxChunksPerPage: 2,
  maxDrafts: 25,
} as const;

export async function withTrialKnowledgeSource<T>(
  orgId: string,
  source: "website" | "gbp" | "file" | "interview",
  work: () => Promise<T>,
  succeeded: (result: T) => boolean
): Promise<T> {
  const trial = await prisma.acquisitionTrial.findUnique({ where: { orgId } });
  if (!trial || trial.convertedAt) return work();
  if (trial.knowledgeSourceUsedAt) throw new Error("Your trial already used its setup source. You can still edit the facts it learned.");
  const reserved = await prisma.acquisitionTrial.updateMany({
    where: { id: trial.id, knowledgeSource: null, knowledgeSourceUsedAt: null },
    data: { knowledgeSource: source },
  });
  if (reserved.count !== 1 && trial.knowledgeSource !== source) {
    throw new Error("Another setup source is already running.");
  }
  try {
    const result = await work();
    if (succeeded(result)) {
      await prisma.acquisitionTrial.update({
        where: { id: trial.id },
        data: { knowledgeSource: source, knowledgeSourceUsedAt: new Date() },
      });
    } else {
      await prisma.acquisitionTrial.updateMany({
        where: { id: trial.id, knowledgeSource: source, knowledgeSourceUsedAt: null },
        data: { knowledgeSource: null },
      });
    }
    return result;
  } catch (error) {
    await prisma.acquisitionTrial.updateMany({
      where: { id: trial.id, knowledgeSource: source, knowledgeSourceUsedAt: null },
      data: { knowledgeSource: null },
    });
    throw error;
  }
}
```

- [ ] **Step 4: Parameterize website ingestion without changing paid defaults**

```ts
export interface IngestBudget {
  maxSubpages: number;
  maxChunksPerPage: number;
  maxDrafts: number;
}
const DEFAULT_INGEST_BUDGET: IngestBudget = {
  maxSubpages: 4,
  maxChunksPerPage: 4,
  maxDrafts: 60,
};
```

Change the existing helper signatures and their two cap expressions exactly:

```diff
-export function discoverLinks(baseUrl: string, html: string): string[] {
+export function discoverLinks(baseUrl: string, html: string, maxSubpages = DEFAULT_INGEST_BUDGET.maxSubpages): string[] {
@@
-    .slice(0, MAX_SUBPAGES)
+    .slice(0, maxSubpages)
@@
-async function modelFacts(pageText: string, orgId: string): Promise<DistilledFact[]> {
+async function modelFacts(pageText: string, orgId: string, maxChunks = DEFAULT_INGEST_BUDGET.maxChunksPerPage): Promise<DistilledFact[]> {
@@
-    let i = 0; i < pageText.length && chunks.length < MAX_CHUNKS_PER_PAGE;
+    let i = 0; i < pageText.length && chunks.length < maxChunks;
```

Replace `ingestWebsite` with the budgeted orchestration below:

```ts
export async function ingestWebsite(
  orgId: string,
  rawUrl: string,
  budget: IngestBudget = DEFAULT_INGEST_BUDGET
): Promise<IngestResult> {
  const startUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const mainHtml = await fetchPage(startUrl);
  if (!mainHtml) throw new Error("Couldn't read that page. Check the URL is public and uses https.");
  const urls = [startUrl, ...discoverLinks(startUrl, mainHtml, budget.maxSubpages)];
  const htmls = new Map<string, string>([[startUrl, mainHtml]]);
  await Promise.all(urls.slice(1).map(async url => {
    const html = await fetchPage(url);
    if (html) htmls.set(url, html);
  }));
  const collected: DistilledFact[] = [];
  for (const [, html] of htmls) {
    const pageText = stripHtml(html);
    if (pageText.length < 40) continue;
    collected.push(...(env.ANTHROPIC_API_KEY
      ? await modelFacts(pageText, orgId, budget.maxChunksPerPage)
      : heuristicFacts(pageText)));
  }
  return {
    pages: htmls.size,
    drafts: await storeDraftFacts(orgId, collected, budget.maxDrafts),
  };
}
```

Change `discoverLinks` and `modelFacts` to accept the exact numeric cap rather
than reading the deleted constants. Make `ingestGbp(orgId, query, budget =
DEFAULT_INGEST_BUDGET)` pass the same budget to both `storeDraftFacts` and its
chained `ingestWebsite` call. Make `ingestFile(orgId, input, maxDrafts =
MAX_DRAFTS_PER_RUN)` pass `maxDrafts` to `storeDraftFacts`. Existing paid
callers omit these optional arguments and keep their current behavior.

- [ ] **Step 5: Wrap trial imports and restrict questionnaire ids**

For website/GBP/file actions, use:

```ts
const result = await withTrialKnowledgeSource(
  ctx.org.id,
  "website",
  () => ingestWebsite(ctx.org.id, trimmed, TRIAL_INGEST_BUDGET),
  value => value.drafts > 0
);
```

Use `"gbp"` with `ingestGbp(ctx.org.id, trimmed, TRIAL_INGEST_BUDGET)` and
`"file"` with `ingestFile(ctx.org.id, input, TRIAL_INGEST_BUDGET.maxDrafts)` in
their actions. For trial questionnaire submissions, filter to
`TRIAL_INTERVIEW_IDS`; pass the whole filtered batch through one
`withTrialKnowledgeSource(ctx.org.id, "interview", work, value => value.facts >
0)` call. Reject `submitQuestionnaireAnswerAction` for an acquisition trial
with “Use the 5-question trial setup so your answers are saved together”; this
prevents repeated model calls from bypassing the one-source budget. Paid orgs
retain the one-at-a-time mode and all 20 questions.

- [ ] **Step 6: Run knowledge and credit/cost tests**

Run: `npx vitest run tests/trial-knowledge.test.ts tests/knowledge-ingest.test.ts tests/knowledge-ingest-file.test.ts tests/knowledge-questionnaire.test.ts tests/credit-debit.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit bounded trial training**

```bash
git add src/modules/trial/knowledge.ts src/modules/knowledge/ingest.ts src/app/'(app)'/agent/training-actions.ts src/app/'(app)'/agent/questionnaire/actions.ts tests/trial-knowledge.test.ts tests/knowledge-ingest.test.ts tests/knowledge-ingest-file.test.ts tests/knowledge-questionnaire.test.ts
git commit -m "feat(trial): bound knowledge setup costs"
```

### Task 6: Atomic 15-reply allowance

**Files:**
- Create: `src/modules/trial/replies.ts`
- Modify: `src/app/(app)/inbox/actions.ts`
- Modify: `src/app/(app)/inbox/try/try-your-ai.tsx`
- Create: `tests/trial-replies.test.ts`
- Modify: `tests/inbox.test.ts`

**Interfaces:**
- Produces: `reserveTrialReply(orgId, now?)`, `refundTrialReply(trialId)`, `trialReplySummary(orgId, now?)`.
- Extends: `ActionResult` with `trial?: { status; repliesUsed; replyLimit; repliesRemaining }` and `skipped?: "trial_limit"`.
- Consumes: `handleInboundMessage` and its `reply` result.

- [ ] **Step 1: Write failing quota tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { reserveTrialReply, refundTrialReply } from "@/modules/trial/replies";

describe("trial reply allowance", () => {
  it("reserves reply 15 with one conditional increment and blocks reply 16", async () => {
    // acquisitionTrial.findUnique returns active trial with repliesUsed 14
    // first updateMany returns { count: 1 }; second returns { count: 0 }
    expect(await reserveTrialReply("org_1", new Date("2026-09-20T00:00:00Z")))
      .toMatchObject({ kind: "reserved", repliesRemaining: 0 });
    expect(await reserveTrialReply("org_1", new Date("2026-09-20T00:00:01Z")))
      .toMatchObject({ kind: "blocked", status: "exhausted" });
  });

  it("refunds without allowing the counter below zero", async () => {
    await refundTrialReply("trial_1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", repliesUsed: { gt: 0 } },
      data: { repliesUsed: { decrement: 1 } },
    });
  });
});
```

Add an action test where `handleInboundMessage` throws and expect a refund; a
STOP/no-profile/no-reply result also refunds; a result with `reply` keeps the
slot. Mock two concurrent conditional increments at 14 and assert only one gets
`kind: "reserved"`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/trial-replies.test.ts tests/inbox.test.ts`

Expected: FAIL because no quota is enforced.

- [ ] **Step 3: Implement state lookup, atomic reserve, and guarded refund**

```ts
export async function reserveTrialReply(orgId: string, now = new Date()) {
  const trial = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    include: { org: { select: { subscriptionStatus: true } } },
  });
  if (!trial || trial.convertedAt || trial.org?.subscriptionStatus === "active") {
    return { kind: "not_trial" as const };
  }
  const status = deriveTrialStatus({
    ...trial,
    startedAt: trial.startedAt,
    subscriptionStatus: trial.org?.subscriptionStatus ?? "inactive",
  }, now);
  if (status !== "active") return { kind: "blocked" as const, status };
  const reserved = await prisma.acquisitionTrial.updateMany({
    where: {
      id: trial.id,
      convertedAt: null,
      expiresAt: { gt: now },
      repliesUsed: { lt: trial.replyLimit },
    },
    data: { repliesUsed: { increment: 1 } },
  });
  if (reserved.count !== 1) {
    return { kind: "blocked" as const, status: "exhausted" as const };
  }
  const repliesUsed = trial.repliesUsed + 1;
  return {
    kind: "reserved" as const,
    trialId: trial.id,
    repliesUsed,
    replyLimit: trial.replyLimit,
    repliesRemaining: Math.max(0, trial.replyLimit - repliesUsed),
  };
}

export async function refundTrialReply(trialId: string) {
  await prisma.acquisitionTrial.updateMany({
    where: { id: trialId, repliesUsed: { gt: 0 } },
    data: { repliesUsed: { decrement: 1 } },
  });
}
```

- [ ] **Step 4: Enforce the quota around the existing inbound path**

At the start of `simulateInboundAction`, after simulation/field validation and
before calling `handleInboundMessage`:

```ts
const reservation = await reserveTrialReply(org.id);
if (reservation.kind === "blocked") {
  return {
    ok: false,
    message: reservation.status === "expired"
      ? "Your seven-day trial has ended. Book your free setup demo to continue."
      : "You've used all 15 test replies. Book your free setup demo to continue.",
    skipped: "trial_limit",
    trial: await trialReplySummary(org.id),
  };
}
```

After `handleInboundMessage`, refund if `reservation.kind === "reserved"` and
`!result.reply`; in `catch`, refund before returning the friendly error. On a
successful reply, return `trialReplySummary(org.id)` so the client counter is
immediately authoritative.

- [ ] **Step 5: Display the server-returned remainder without changing paid behavior**

In `TryYourAi`, keep local trial summary state only when the action returns it:

```ts
if (result.trial) setTrialSummary(result.trial);
```

Render `N test replies left` beside the send button. Do not yet redesign the
redirecting tester; the guided inline conversation is Phase 2.

- [ ] **Step 6: Run quota plus protected agent tests**

Run: `npx vitest run tests/trial-replies.test.ts tests/inbox.test.ts tests/agent.test.ts tests/agent-loop-cap.test.ts tests/model-guard.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the reply ceiling**

```bash
git add src/modules/trial/replies.ts src/app/'(app)'/inbox/actions.ts src/app/'(app)'/inbox/try/try-your-ai.tsx tests/trial-replies.test.ts tests/inbox.test.ts
git commit -m "feat(trial): enforce fifteen AI replies"
```

### Task 7: Foundation verification, RLS instruction, and progress record

**Files:**
- Modify: `PROGRESS.md`
- Modify: `.env.example` only if implementation introduced a new environment variable (none is expected).

**Interfaces:**
- Consumes: every deliverable in Tasks 1–6.
- Produces: a green, documented foundation ready for the guided-experience plan.

- [ ] **Step 1: Run Prisma/schema checks**

Run: `npx prisma format && npx prisma validate && npx prisma generate`

Expected: all commands exit 0.

- [ ] **Step 2: Run the focused foundation suite**

Run: `npx vitest run tests/trial-state.test.ts tests/trial-signup.test.ts tests/trial-claim.test.ts tests/trial-capabilities.test.ts tests/trial-knowledge.test.ts tests/trial-replies.test.ts tests/signup-closed.test.ts tests/plan-limits.test.ts tests/inbox.test.ts`

Expected: PASS.

- [ ] **Step 3: Run invariant and full verification**

Run: `npm test && npm run lint && npm run build`

Expected: all commands exit 0. If the real-database concurrency test is skipped
because `TEST_DATABASE_URL` is absent, record that fact rather than pointing it
at a shared or production database.

- [ ] **Step 4: Record the completed foundation**

Append to `PROGRESS.md` without editing older entries:

```md
## 2026-09-20 — Free-trial foundation

- Added pending acquisition trials with secure one-use claims while global signup remains closed.
- Added server-side restricted capabilities, one bounded training source, and an atomic seven-day/15-reply allowance.
- Trial workspaces remain tenant-isolated and simulated; paid checkout can later activate the same org.
- New `AcquisitionTrial` and `AcquisitionTrialEvent` tables require `npm run db:rls` immediately after `npm run db:push` in every environment.
```

- [ ] **Step 5: Commit the verified foundation record**

```bash
git add PROGRESS.md
git commit -m "docs(trial): record secure trial foundation"
```

Deployment note (do not run against an unconfirmed database): after review and
before deploying application code, run `npm run db:push` followed immediately by
`npm run db:rls`, then verify both new tables report RLS enabled.
