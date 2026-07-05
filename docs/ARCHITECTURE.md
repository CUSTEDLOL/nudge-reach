# ARCHITECTURE — Nudge

How this repo is organised, and the one rule for where new code goes. Read this
before adding a file. Structure mirrors the **architecture** (bounded contexts),
not depth for its own sake — typically 2–3 levels.

## Top-level shape

```
src/
  app/                  # Next.js App Router — routes ONLY. Thin. No business logic.
    (app)/              #   authenticated dark-shell route group
    api/                #   route handlers (webhooks, cron, json endpoints)
    auth/ login/ ...    #   public routes + auth callback/confirm/signout
    proxy.ts            #   Next 16 middleware (session refresh) — lives beside app/
  modules/              # domain modules — one folder (or file) per bounded context
    agent/              #   runAgent loop, tools/, prompt, window rules, inbound handler
    messaging/          #   channel-agnostic sendMessage + drivers/{simulation,live}
    send/               #   consent-gated send queue + simulated delivery lifecycle
    consent.ts          #   pure canSendMarketing gate (protected invariant)
    campaign/           #   generation (model-router), guardrails, schema
    whatsapp/           #   Meta template payload/approval + inbound webhook-verify
    inbox/              #   shared-inbox queries, filters, formatting
    contacts/           #   segments (most CRUD lives in the route actions.ts)
    automations/ →      #   `automation/`  engine, triggers, definitions, draft
    analytics/          #   volume/rate/funnel/agent computations
    billing/            #   plans, money format, razorpay/, stripe/, limits
    integrations/       #   api-keys, outbound-webhooks (calendar/ added in Phase 5)
    orgs/               #   auth helpers (auth, org), memberships, audit log
    dashboard/ demo/ ai/ email/
  components/
    ui/                 # the primitive kit — the ONLY primitive layer (317 refs)
    features/           # app-level compositions (app-shell, charts, whatsapp-preview)
    marketing/          # public landing composition (owned by Phase 6)
  lib/                  # genuinely cross-cutting ONLY:
                        #   model-router, crypto, db, env(+schema), cn, csv,
                        #   phone, rate-limit, supabase/
docs/   gtm/   prisma/   tests/   scripts/     # repo root
```

## The alias

`@/*` → `./src/*` (tsconfig + vitest both). Import everything through `@/…`
(`@/modules/agent`, `@/components/ui/button`, `@/lib/db`). Avoid deep relative
paths that cross a module boundary — they break when files move.

## The rule for where new code goes

1. **Is it a route?** → `src/app/…`, and keep it thin. Page/route files wire UI to
   a module; server actions colocate as `actions.ts` next to the route.
2. **Is it business logic for a bounded context?** → `src/modules/<context>/`.
   Reuse an existing module before making a new one. A context with a single file
   stays a file (`consent.ts`); it grows into a folder only when it needs to.
3. **Is it a UI primitive?** → `src/components/ui/`. A feature composition →
   `src/components/features/`. Nothing else may define primitives.
4. **Is it genuinely cross-cutting** (used by 3+ unrelated modules, no domain of its
   own)? → `src/lib/`. If it belongs to a domain, it goes in that module, not lib.
5. **Tests** mirror the module under test in `tests/` (flat today; name by subject).

## Platform vs product

Auth (`orgs/`), messaging, consent, model-router, billing, and integrations are
**platform** modules — product 2 (email) reuses them. Keep them generic and free of
WhatsApp-specific assumptions. WhatsApp-specific code lives in `whatsapp/`,
`campaign/`, and the messaging **drivers**.

## Deviations from the original target (stated per operating rule 0.1)

- Module folder names keep their **existing singular** names (`campaign`,
  `automation`) rather than pluralising — avoids a rename on top of a move. Import
  specifiers were only changed where the folder physically moved.
- `consent` and `contacts` are intentionally thin (a file / one file) — most
  contacts CRUD lives in `app/(app)/contacts/actions.ts`, the repo-wide pattern of
  colocating server actions with their route.
- `components/marketing/` stays a **sibling** of `ui/` and `features/` (not nested
  under features) because it is the public site and Phase 6 rebuilds it wholesale.
- The `lib/webhook` vs `lib/webhooks` footgun is resolved: inbound Meta
  verification is now `modules/whatsapp/webhook-verify.ts`; outbound signed events
  are `modules/integrations/outbound-webhooks.ts`.
```
