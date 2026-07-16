# Meta compliance — outbound & marketing (business-initiated)

Scope: anything **the business starts** — follow-ups to leads, booking reminders,
no-show recovery, and promotional **campaigns** to a client's own list. Companion
to [META_COMPLIANCE_INBOUND.md](META_COMPLIANCE_INBOUND.md) (the customer-initiated
side) and to the 7 invariants in [AGENTS.md](../AGENTS.md). Strategy: leads with
the flagship, campaigns ride inside it — [STRATEGY.md](STRATEGY.md) §7.

> **Confidence flags.** The opt-in rule, the 24h window, template categories, and
> the messaging-tier ladder are stable Meta primary-doc facts (high confidence).
> Exact current tier numbers and pricing shift — verify on Meta's live pricing +
> messaging-limits docs before quoting to a client.

---

## The one rule that matters: opt-in

WhatsApp marketing is fully permitted. The **only** hard requirement is that
**every recipient of a business-initiated message has opted in.** Everything else
(volume, campaigns, product→campaign→send, running campaigns alongside the agent)
is allowed and is exactly what AiSensy/WATI do.

**Bans come from consent, not volume.** Meta's spam system keys on **block rate +
report rate**, not how many you send. Cold/scraped/purchased numbers get the
number banned at *any* drip rate — "warming" by sending 50 strangers/day does not
work, and no tool (AiSensy included) makes un-consented messaging safe. AiSensy
users who upload cold lists get banned *by Meta*, not protected by AiSensy.

This is invariant #2 (consent enforced in code) and invariant #1 (official API,
no gray-market). Our codebase is built to refuse cold sends; that is the feature
that keeps clients' numbers alive.

### What counts as opt-in (and is provable)
- The customer messaged the business first (inbound).
- Clicked a Click-to-WhatsApp ad or a Page/website "chat on WhatsApp" button.
- Ticked a clear consent box ("I agree to receive WhatsApp updates from [X]").
- Gave their number in person for a stated purpose (front-desk / intake form).

**Not opt-in:** bought lists, scraped numbers, "we already had their number."

> **No paid ads required.** A clinic's own patient list (numbers given at the
> desk, with a consent checkbox) is a compliant marketing audience. We do not
> need to run Meta/CTWA ads for clients — that only changes their cost base. CTWA
> is an *optional* lead engine, not a prerequisite.

---

## The 24-hour window and message types

- **Inside the window** (customer messaged in last 24h): free-form, no template,
  effectively free. This is the inbound agent's home — see the inbound doc.
- **Outside the window** (business re-initiating): **approved templates only.**
  This is where all outbound (follow-ups, reminders, campaigns) lives.
- Template categories:
  - **Utility** — order/booking/account updates tied to a real event. Cheaper,
    lower-risk, higher approval rate. Prefer this for follow-ups/reminders.
  - **Marketing** — promotions/offers. Most expensive, most scrutinized.
  - **Authentication** — OTPs (not our use case).
- Every template is reviewed by Meta (usually minutes–a day) and must carry an
  opt-out (e.g. "Reply STOP to unsubscribe"). STOP is honored **permanently**
  (implemented: `isStopMessage`, invariant #2).

---

## The messaging-tier ladder (this is the real "limit")

Per client number, business-initiated conversations per rolling 24h:

| Client status | Limit / 24h |
|---|---|
| Business **not verified** with Meta | **250** unique customers |
| Business **verified** + 1 approved template + display name | **1,000** (Tier 1) |
| Good quality, using ≥~50% of limit | **10,000** (Tier 2) |
| …continues on quality | **100,000** (Tier 3) |
| Next | **Unlimited** |

- Counts **business-initiated** conversations only — inbound/agent replies don't
  consume the tier.
- Meta **auto-upgrades** tiers (often within days) when you use your limit while
  keeping quality **Green**. *This* is the legitimate "inbox warming": start with
  the warmest opted-in leads so almost nobody blocks you, quality stays high, and
  Meta raises the ceiling. Sell it as a feature ("we grow your reach the way Meta
  rewards, and protect your number's health").
- A target of ~1,000 sends/month sits comfortably inside even Tier 1's *daily*
  allowance.

---

## Two verifications (don't conflate them)

| | Controls | Needed for |
|---|---|---|
| **Client's** Meta Business Verification | *Their* sending limit (250 → 1,000+) | Every client that sends outbound beyond 250/day |
| **Nudge's** business verification + App Review | How *we* operate across many clients | Becoming a Tech Provider (scale onboarding) |

Incorporating Nudge is for the second row (Tech Provider / Embedded Signup) — it
does **not** by itself change any single client's 250→1,000 limit; that is the
client's own verification.

---

## The three access models

| Model | What it is | When |
|---|---|---|
| **Per-client manual** | Each client's own Meta app + WABA; credentials pasted into our dashboard (`Settings → WhatsApp`, encrypted at rest). No big App Review for us. | First ~1–10 clients — prove revenue. |
| **Tech Provider (Model A)** — *what AiSensy is* | Nudge verified + App Review for `whatsapp_business_messaging` + `whatsapp_business_management` + Embedded Signup; clients self-connect their WABA; **Meta bills the client directly.** | The scale path. |
| **Solution Partner (Model B)** | Meta credit line; Meta bills *us*, we bill clients (markup); partner-directory listing. | Later, only to resell conversation volume. Not needed to start. |

---

## Go-live checklist for marketing

**Nudge (one-time):**
1. Incorporate a legal entity (India: Private Limited is cleanest for Meta
   verification; LLP/registered proprietorship can work).
2. Meta Business Verification for Nudge.
3. App Review / Advanced Access for `whatsapp_business_messaging` +
   `whatsapp_business_management` (shared with the inbound agent).
4. Embedded Signup (scale) — manual connect form covers first partners.

**Per client:**
5. Client business verification (lifts 250 → 1,000/day).
6. Approved templates (prefer Utility for service content; Marketing for promos).
7. Approved display name.
8. Payment method on the **client's** WABA (Model A — client pays Meta).

**In-product (mostly built):**
9. Opt-in capture **with source + timestamp** (`optInSource`, `optInAt`) — the
   proof that defends every send. Double consent-gated (queue + `sendMessage`).
10. Permanent STOP/opt-out; imports can never resurrect an `optedOutAt`.
11. 24h-window enforcement on every free-form path (built).

---

## Ongoing / India specifics

- **Quality rating** (Green/Yellow/Red) is per number, driven by blocks/reports.
  Good agent replies *raise* it; cold sends tank it. Keep the outbound list warm
  and consented.
- **Commerce policy** — prohibited verticals apply (alcohol, tobacco, drugs/
  pharma, weapons, gambling, adult, MLM…). Clinics fine; keep the agent off
  medical advice.
- **DPDP Act 2023 (India)** — store consent with source + timestamp, support
  deletion, encrypt tokens at rest (built). A data-handling obligation, not a
  messaging gate.
- **TRAI DLT does NOT apply to WhatsApp Cloud API** (that's SMS). No DLT/template
  registration with TRAI; the only template registration is Meta's.

---

## What's built vs. what's left

**Built:** consent gate (`canSendMarketing`), double-gating, permanent STOP,
24h-window enforcement, per-org encrypted credentials, template payload builder,
send queue, follow-up engine.

**Left:** (1) opt-in **source/timestamp record** surfaced in onboarding/import;
(2) Embedded Signup for self-serve; (3) messaging-tier + quality-rating display
in the dashboard; (4) campaign audience picker hard-gated to `optedIn` with the
consent source shown at send time.
