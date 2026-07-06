# SECURITY — posture, guarantees, and honest limitations

What Nudge actually does to protect tenant data, secrets, and WhatsApp
compliance — with file references so every claim is checkable — plus the
things it deliberately does *not* do yet. Paths reflect the `src/` structure
(see `docs/ARCHITECTURE.md`).

---

## 1. Tenant isolation

Two independent layers:

1. **Org-scoped queries (primary).** Every protected page and server action
   resolves the caller with `requireOrg()` / `requireOrgContext()`
   (`src/modules/orgs/auth.ts` — Supabase `getClaims()`, never `getSession()`
   server-side) and scopes every Prisma query with `where: { orgId: org.id }`
   or an org-scoped lookup. `callerOrgFilter(userId)` (`src/modules/orgs/org.ts`)
   is the shared owner-OR-member filter used by the lightweight polling routes
   (campaign stats, template status), so their scope can't drift apart.
   There is no code path that queries across orgs on behalf of a user.
2. **RLS deny-all (defense in depth).** Supabase's Data API exposes `public`
   tables to the publishable key by default. `npm run db:rls`
   (`scripts/enable-rls.ts`) enumerates *all* `public` tables via `pg_tables`
   and enables Row Level Security **with no policies** on each, so the
   browser-side publishable key can read/write nothing. Prisma connects as the
   table owner and bypasses RLS — all data access goes through server code.
   Re-run after every `db:push` (new tables start with RLS disabled).

The auth proxy (`src/proxy.ts` → `src/lib/supabase/proxy-session.ts`) redirects
signed-out visitors and keeps sessions fresh, but it is convenience, not the
boundary — pages and actions verify auth themselves.

## 2. Roles and server-side enforcement

- Roles: `OWNER` (everything) > `ADMIN` (everything but billing/org-delete)
  > `AGENT` (inbox + contacts only). Ordering and gating live in
  `src/modules/orgs/auth.ts` (`hasRole`, `requireRole`).
- Role checks are **server-enforced in the mutating actions**, not just
  hidden in the UI. Every org-wide mutation is gated, verified by a defensive
  re-audit of all 14 action files and 14 route handlers:
  - AI agent persona (`settings/agent/actions.ts`) — ADMIN. The agent controls
    what auto-replies to customers; a hidden nav item is not enforcement.
  - Campaign edit (`campaigns/actions.ts` `updateCampaignAction`) — ADMIN, like
    every other campaign action (it can reset an approved campaign to DRAFT).
  - Data export (contacts + message history) — ADMIN (bulk PII/conversation
    exfiltration is not an AGENT capability).
  - WhatsApp connection test (`integrations/actions.ts`) — ADMIN (it decrypts
    the org token in live mode).
- Owner-role hygiene (`settings/team/actions.ts`): only an OWNER may grant/take
  the OWNER role; demoting the **last** OWNER is blocked server-side.

## 3. Secrets at rest

| Secret | Storage | Details |
|---|---|---|
| WhatsApp access tokens (per org) | **AES-256-GCM** ciphertext | `src/lib/crypto.ts`: key = SHA-256 of `TOKEN_ENCRYPTION_KEY`, random 12-byte IV per encryption, auth tag verified on decrypt (tampering fails). Stored in `WhatsappAccount.accessTokenEncrypted`. |
| API keys | **SHA-256 hash only** | `src/modules/integrations/api-keys.ts`: the full `nk_live_…` key is returned exactly once at creation; only the hash + a short display prefix persist. Revoked, never deleted (audit trail). |
| Outbound webhook secrets | Plaintext per endpoint | `whsec_` + 24 random bytes, generated server-side; used only for HMAC signing. |
| User passwords | Never stored by Nudge | Supabase Auth owns credentials. |

`TOKEN_ENCRYPTION_KEY` (32+ chars) is required whenever credentials are
saved and at boot in live mode.

## 4. Webhook signatures, payment integrity & redirect safety

**Inbound — Meta WhatsApp** (`src/app/api/webhooks/whatsapp/route.ts`):
- `X-Hub-Signature-256` verified against the **raw body** with HMAC-SHA256
  (`META_APP_SECRET`) using `crypto.timingSafeEqual`
  (`src/modules/whatsapp/webhook-verify.ts`, unit-tested). Bad signature → 401;
  secret not configured → 503 (fail closed). The subscription-handshake verify
  token is compared timing-safely too.
- Raw events are stored (`WebhookEvent`) before processing — audit trail +
  idempotent reprocessing; status updates are forward-only, so out-of-order /
  replayed deliveries can't regress state.
- **Template-status events are org-scoped.** The update resolves the org that
  owns the event's WABA (`entry.id` → `WhatsappAccount.wabaId`) and scopes the
  template lookup to it, so one tenant's Meta status event can never flip
  another tenant's identically-named template.

**Inbound — Razorpay / Stripe** (`src/app/api/webhooks/{razorpay,stripe}/route.ts`):
- Signatures verified with HMAC over the raw body (timing-safe); Stripe adds a
  replay-timestamp tolerance. The webhook — not the client — is the source of
  truth for subscription state, reading `orgId`/`planId` from server-set
  metadata attached at checkout creation.
- **Confirm-path payment integrity.** The browser confirm action
  (`settings/billing/actions.ts`) verifies the Razorpay signature *and* then
  re-fetches the order (`GET /v1/orders/{id}`) to derive the plan from the
  order's server-set `notes` and to check the captured `amount` matches the
  plan price — the client-supplied `planId` is never trusted. A genuine ₹999
  payment cannot be redeemed for a higher tier.

**Outbound — Nudge webhooks to your systems**
(`src/modules/integrations/outbound-webhooks.ts`):
- Every delivery carries `X-Nudge-Event` and `X-Nudge-Signature: sha256=<hex>`
  = HMAC-SHA256 of the raw JSON body with the endpoint's secret. Fire-and-forget
  with an 8s timeout, logged per attempt (`WebhookDelivery`).
- **SSRF guard.** Before delivery the URL must be `https` and every resolved
  address must be public — private / loopback / link-local / CGNAT / cloud-
  metadata ranges (`169.254.169.254`, `10/8`, `127/8`, `fc00::/7`, …) are
  rejected (`assertPublicHttpsUrl` / `isBlockedIp`), and the fetch refuses to
  follow redirects, so a 3xx to an internal host can't slip past the check.

**Open-redirect safety.** The auth callback/confirm routes build their
post-login redirect from a user-controlled `next` param through
`safeRelativePath` (`src/lib/safe-redirect.ts`), which accepts only same-site
absolute paths — protocol-relative (`//`), backslash, and encoded-slash tricks
fall back to `/dashboard`.

Consumer verification for outbound webhooks (Node):

```js
const crypto = require("node:crypto");
function verifyNudgeWebhook(rawBody, signatureHeader, secret) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return (
    typeof signatureHeader === "string" &&
    signatureHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  );
}
```

## 5. CSV formula-injection defense

Every CSV export goes through `src/lib/csv.ts` (`csvField`): values starting
with `=` `+` `-` `@` tab or CR get a neutralizing apostrophe before RFC-4180
quoting (CWE-1236), so an attacker-controlled contact name like
`=HYPERLINK(...)` cannot execute when opened in Excel/Sheets.

## 6. Consent and WhatsApp compliance guarantees

Enforced in code, not just UI:

- **Opt-in gate at the lowest layer.** `sendMessage()`
  (`src/modules/messaging/index.ts`) — the single send entry point — refuses
  MARKETING sends to any recipient failing `canSendMarketing()`
  (`src/modules/consent.ts`), regardless of the UI or queue above. The send
  queue also checks consent at fan-out; skipped recipients are counted.
- **Opt-out is permanent.** `optedOutAt` set = excluded forever; CSV re-import
  never resurrects an opted-out contact; automations inherit the gate.
- **STOP handling.** Inbound `STOP` / `unsubscribe` / `opt out`
  (`src/modules/whatsapp/webhook-verify.ts`) permanently opts out — before any
  automation or AI reply, both suppressed for that message.
- **24-hour window rule.** Free-form replies only within 24h of the customer's
  last inbound (`src/modules/agent/window.ts`); outside it the composer is
  disabled and switches to approved templates only.
- **Opt-out footer can't be edited away.** `repairOptOutFooter` runs on both AI
  generation and human edits, campaign and library templates alike.
- **AI never auto-sends in the inbox.** Suggest-reply produces a draft; a human
  clicks send. The optional auto-reply agent is per-org, grounded only in
  owner-provided business info, scoped per Meta's 2026 AI policy, hands off to a
  human via a sentinel, and its tool loop is hard-capped (`runAgent maxSteps`).
- **Official Cloud API only.** No unofficial WhatsApp automation exists anywhere
  in the codebase (repo rule 1).

## 7. Environment hygiene

- **No secrets in `NEXT_PUBLIC_*`.** The only public vars are the Supabase URL,
  the publishable key (public by design, RLS-blocked anyway), and the app
  origin. Verified: `"use client"` files import server modules only via
  `import type` (erased at compile).
- **Boot-time validation.** `src/lib/env-schema.ts` (Zod) validates env at boot;
  `SEND_MODE=live` refuses to start without all WhatsApp vars +
  `TOKEN_ENCRYPTION_KEY`. Skipped during `next build` so CI needs no secrets.
- `.env` / `.env.local` are git-ignored; `.env.example` is the documented
  surface. Runtime AI is locked to the cheap Haiku tier —
  `src/lib/model-router/guard.ts` throws on expensive models.

## 8. Rate limiting

- Public waitlist (per client IP, taken from the platform-attested `x-real-ip`
  so it can't be rotated past the throttle by spoofing `x-forwarded-for`),
  AI suggest (per org), outbound Meta test pings (per org). Inbound webhooks are
  signature-gated rather than throttled.
- The cron queue-processor requires Vercel Cron's bearer when `CRON_SECRET` is
  set (timing-safe compare); every op it runs is idempotent and consent-gated.
  **Production must set `CRON_SECRET`** (see `docs/GO_LIVE_WHATSAPP.md`).

## 9. Known limitations (honest list)

- **Rate limiting is in-process, best-effort.** Per-instance counters; on
  serverless, concurrent instances don't share state, so limits are approximate
  under burst. Shared store (Upstash/Redis) is the upgrade path.
- **Invite auto-join trusts email match.** An invitee joins automatically when a
  Supabase-verified account signs up with the invited address — no invite-token
  handshake yet; anyone controlling that mailbox gets the seat.
- **SSRF guard does not pin DNS.** Hostnames are resolved and checked before the
  fetch, but a TOCTOU DNS-rebind between check and connect is not fully closed
  (redirect-follow is disabled, which covers the common vector). Acceptable for
  the self-configured-endpoint threat model; pin-on-connect is the upgrade.
- **Single-region database.** One Supabase project (ap-southeast-1); rely on
  Supabase backups for DR.
- **Outbound webhooks are fire-and-forget.** Failed deliveries are logged, not
  retried automatically.
- **`npm audit`**: one transitive moderate (PostCSS via `next`) — not reachable
  in our usage (we don't stringify untrusted CSS); revisit on the next Next
  minor. No production-dependency highs.

## 10. Reporting

Private repository. Report suspected vulnerabilities privately to the
maintainer — do not open a public issue.
