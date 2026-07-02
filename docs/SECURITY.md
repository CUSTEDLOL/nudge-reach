# SECURITY — posture, guarantees, and honest limitations

What Nudge actually does to protect tenant data, secrets, and WhatsApp
compliance — with file references so every claim is checkable — plus the
things it deliberately does *not* do yet.

---

## 1. Tenant isolation

Two independent layers:

1. **Org-scoped queries (primary).** Every protected page and server action
   resolves the caller with `requireOrg()` / `requireOrgContext()`
   (`lib/auth.ts` — Supabase `getClaims()`, never `getSession()` server-side)
   and scopes every Prisma query with `where: { orgId: org.id }` or an
   org-scoped lookup. There is no code path that queries across orgs on
   behalf of a user.
2. **RLS deny-all (defense in depth).** Supabase's Data API exposes `public`
   tables to the publishable key by default. `npm run db:rls`
   (`scripts/enable-rls.ts`) enables Row Level Security **with no policies**
   on every table, so the browser-side publishable key can read/write
   nothing. Prisma connects as the table owner and bypasses RLS — all data
   access goes through the app's server code. This must be re-run after
   every `db:push` (new tables start with RLS disabled).

The auth proxy (`proxy.ts` → `lib/supabase/proxy-session.ts`) redirects
signed-out visitors and keeps sessions fresh, but it is convenience, not the
boundary — pages and actions verify auth themselves.

## 2. Roles and server-side enforcement

- Roles: `OWNER` (everything) > `ADMIN` (everything but billing/org-delete)
  > `AGENT` (inbox + contacts only). Ordering and gating live in
  `lib/auth.ts` (`hasRole`, `requireRole`).
- Role checks are **server-enforced in the mutating actions**, not just
  hidden in the UI (AGENT-hidden nav areas are also server-checked).
- Owner-role hygiene (`app/(app)/settings/team/actions.ts`):
  - Only an OWNER may grant or take away the OWNER role.
  - **Last-owner protection**: demoting the only OWNER is blocked
    server-side ("Promote someone else to owner first").

## 3. Secrets at rest

| Secret | Storage | Details |
|---|---|---|
| WhatsApp access tokens (per org) | **AES-256-GCM** ciphertext | `lib/crypto.ts`: key = SHA-256 of `TOKEN_ENCRYPTION_KEY`, random 12-byte IV per encryption, auth tag verified on decrypt (tampering fails). Format `base64(iv).base64(tag).base64(ct)` in `WhatsappAccount.accessTokenEncrypted`. |
| API keys | **SHA-256 hash only** | `lib/api-keys.ts`: the full `nk_live_…` key is returned exactly once at creation; only the hash + a short display prefix persist. Keys are revoked, never deleted (audit trail). |
| Outbound webhook secrets | Plaintext per endpoint | `whsec_` + 24 random bytes, generated server-side; used only for HMAC signing. |
| User passwords | Never stored by Nudge | Supabase Auth owns credentials. |

`TOKEN_ENCRYPTION_KEY` (32+ chars) is required whenever credentials are
saved and at boot in live mode.

## 4. Webhook signature verification

**Inbound — Meta WhatsApp** (`app/api/webhooks/whatsapp/route.ts`):
- `X-Hub-Signature-256` verified against the **raw body** with HMAC-SHA256
  (`META_APP_SECRET`) using `crypto.timingSafeEqual`
  (`lib/webhook/verify.ts`, unit-tested). Bad signature → 401; secret not
  configured → 503 (fail closed).
- Raw events are stored (`WebhookEvent`) before processing — audit trail +
  idempotent reprocessing; message status updates are forward-only, so
  out-of-order/replayed deliveries can't regress state.

**Inbound — Razorpay** (`app/api/webhooks/razorpay/route.ts`):
- `X-Razorpay-Signature` verified with HMAC-SHA256 over the raw body using
  `RAZORPAY_WEBHOOK_SECRET`, timing-safe compare (`lib/billing/razorpay.ts`).
  Browser checkout confirmations are additionally verified via
  HMAC(`order_id|payment_id`). The webhook — not the client — is the source
  of truth for subscription state.

**Outbound — Nudge webhooks to your systems** (`lib/webhooks/dispatch.ts`):
- Every delivery carries `X-Nudge-Event` and
  `X-Nudge-Signature: sha256=<hex>` = HMAC-SHA256 of the raw JSON body with
  the endpoint's secret — the same scheme as Meta's, so integrators have one
  mental model. Deliveries are fire-and-forget with an 8s timeout and are
  logged per attempt (`WebhookDelivery`).

Consumer verification (Node):

```js
const crypto = require("node:crypto");

function verifyNudgeWebhook(rawBody, signatureHeader, secret) {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return (
    typeof signatureHeader === "string" &&
    signatureHeader.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  );
}

// Express example — verify BEFORE parsing JSON, on the raw body:
// app.post("/hooks/nudge", express.raw({ type: "*/*" }), (req, res) => {
//   if (!verifyNudgeWebhook(req.body.toString("utf8"),
//       req.get("X-Nudge-Signature"), process.env.NUDGE_WEBHOOK_SECRET))
//     return res.status(401).end();
//   ...
// });
```

## 5. CSV formula-injection defense

Every CSV export goes through `lib/csv.ts` (`csvField`): values starting
with `=` `+` `-` `@` tab or CR get a neutralizing apostrophe before RFC-4180
quoting (CWE-1236), so an attacker-controlled contact name like
`=HYPERLINK(...)` cannot execute when the export is opened in Excel/Sheets.

## 6. Consent and WhatsApp compliance guarantees

These are enforced in code, not just UI:

- **Opt-in gate at the lowest layer.** `sendMessage()` in
  `lib/messaging/index.ts` — the single send entry point — refuses MARKETING
  template sends to any recipient failing `canSendMarketing()`
  (`lib/consent.ts`), regardless of what the UI or queue above did. The send
  queue also checks consent at fan-out; skipped recipients are counted and
  surfaced.
- **Opt-out is permanent.** `optedOutAt` set = excluded forever; CSV
  re-import never resurrects an opted-out contact; automations inherit the
  gate (a consent-blocked step fails and is logged).
- **STOP handling.** Inbound `STOP` / `unsubscribe` / `opt out` (regex in
  `lib/webhook/verify.ts`) permanently opts the contact out — before any
  automation or AI reply, which are both suppressed for that message.
- **24-hour window rule.** Free-form replies only within 24h of the
  customer's last inbound message (`lib/agent/window.ts`); outside it the
  inbox composer is disabled and switches to approved templates only.
- **Opt-out footer can't be edited away.** `repairOptOutFooter` runs on both
  AI generation and human edits of MARKETING content, campaign and library
  templates alike.
- **AI never auto-sends in the inbox.** Suggest-reply produces a draft in
  the composer; a human clicks send. The optional auto-reply agent is
  per-org, grounded only in owner-provided business info, refuses off-topic
  questions (scoped per Meta's 2026 AI policy), and hands off to a human via
  a sentinel when the customer is upset or asks for a person. Automations
  run before the agent so a customer never gets two replies to one message.
- **Official Cloud API only.** No unofficial WhatsApp automation exists
  anywhere in the codebase (repo rule 1).

## 7. Environment hygiene

- **No secrets in `NEXT_PUBLIC_*`.** The only public vars are the Supabase
  URL, the publishable key (designed to be public, and RLS-blocked anyway),
  and the app origin.
- **Boot-time validation.** `lib/env-schema.ts` (Zod) validates env at boot;
  `SEND_MODE=live` refuses to start without all WhatsApp vars +
  `TOKEN_ENCRYPTION_KEY`. Validation is intentionally skipped during
  `next build` so CI needs no secrets.
- `.env` / `.env.local` are git-ignored; `.env.example` is maintained as the
  documented surface. Runtime AI is locked to the cheap Haiku tier —
  `lib/model-router/guard.ts` throws on expensive models.

## 8. Known limitations (honest list)

- **Rate limiting is in-process, best-effort.** Send pacing (and request
  throttling as it lands in the current hardening work stream) uses
  per-instance state; on serverless, concurrent instances don't share
  counters, so limits are approximate under burst. A shared store (e.g.
  Upstash/Redis) would be the upgrade path.
- **Invite auto-join trusts email match.** An invitee joins the workspace
  automatically when a Supabase-verified account signs up with the invited
  address. This trusts Supabase's email verification; anyone controlling
  that mailbox gets the seat. There is no invite-token handshake yet.
- **Single-region database.** One Supabase project (ap-southeast-1), no read
  replicas or cross-region failover. Rely on Supabase backups for DR.
- **Outbound webhooks are fire-and-forget.** Failed deliveries are logged
  (status visible in Integrations) but not retried automatically.
- **Inbound template status matching is by name.** Meta's template-status
  webhook is matched to the most recent template with that name — fine for
  the current one-number-per-org model, coarse for heavy multi-tenant reuse.
- Plan-limit enforcement, audit logs, and a one-click demo reset are being
  added in a parallel hardening work stream; until they land, plan limits
  are surfaced in the UI but not hard-enforced, and the audit trail is
  limited to webhook/delivery/automation logs.

## 9. Reporting

Private repository. Report suspected vulnerabilities privately to the
maintainer — do not open a public issue.
