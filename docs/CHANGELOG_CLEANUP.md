# CHANGELOG_CLEANUP — Phase 3 redundancy & inconsistency purge

Every deletion and normalization from Phase 3, logged so nothing vanishes
silently. Verified against `depcheck`, `ts-prune`, and per-symbol grep across
`src/`, `tests/`, and `scripts/`.

## Dead code removed (definition-only, zero references anywhere)

| Symbol / file | Was in | Why dead |
|---|---|---|
| `ensureOrg()` | `src/modules/orgs/org.ts` | Legacy "kept for existing call sites" wrapper; all call sites now use `requireOrgContext()`. Zero references. |
| `tickCampaignAction()` | `src/app/(app)/campaigns/actions.ts` | Old dashboard-tick server action; the dashboard now ticks server-side via `processQueue` directly. Zero references. Removed the now-orphaned `applySimulatedProgress` import too. |
| `istHour()` | `src/modules/dashboard/format.ts` | Superseded by `hourInTimezone(tz, now)` after the global-markets change. Zero references. |
| `formatInrRupees()` | `src/modules/dashboard/format.ts` | Legacy INR-only formatter; superseded by the currency-aware `formatMajorAmount()`. Only referenced by its own test (also removed). |
| `gatewayFor()` | `src/modules/billing/money.ts` | Gateway is read directly off `CURRENCY_INFO[...].gateway` at the two call sites. Zero references. |
| `verticalLabel()` | `src/modules/dashboard/verticals.ts` | Unused; `VERTICALS` / `isVertical` (used by the onboarding wizard) are kept. |
| `SimpleBarChart` (whole file `bar-chart.tsx`) | `src/components/features/charts/` | Orphaned chart component — the analytics surfaces use area/funnel/bar-tooltip charts, never this generic wrapper. Zero references. |

## Test cleanup

- `tests/dashboard.test.ts` — dropped the `formatInrRupees` assertions and
  import (the helper it covered was removed). `formatCount` coverage kept.

## Inconsistencies / stale references fixed

- **Stale schema comment** — `prisma/schema.prisma` `Org.plan` comment said
  `free | starter | growth | scale`; the code uses `pro` (legacy `scale`→`pro`
  mapped in `getPlan`). Now `free | starter | growth | pro`.
- **App metadata copy drift** — `src/app/layout.tsx` `<head>` title/description/
  OG/Twitter said "WhatsApp CRM your whole team runs on". Rewritten to the
  AI-Front-Desk positioning (the app-wide metadata; the landing page hero/footer
  copy is Phase 6). Keywords updated accordingly.
- **`webhook` vs `webhooks` folder footgun** — already resolved in Phase 2
  (`whatsapp/webhook-verify` for inbound Meta verification vs
  `integrations/outbound-webhooks` for outbound signed events).

## Verified NOT dead (kept deliberately)

- `CardFooter` (`components/ui/card.tsx`) — part of the primitive UI kit; kept
  for completeness/stability even though currently unreferenced.
- `sendEmail` / `appOrigin` (`modules/email/`) — product-2 (email channel)
  platform scaffolding; intentional, and `appOrigin` is used by billing.
- `GradientText` (`components/marketing/section.tsx`) — marketing surface owned
  by Phase 6; left for the landing rebuild.

## Dependencies

- `depcheck`: no unused runtime dependencies. The two flagged devDeps
  (`tailwindcss`, `@tailwindcss/postcss`) are Tailwind-v4 false positives (used
  via `postcss.config.mjs` + CSS `@import`), kept.

## Patterns (already unified; no mass change needed)

- Auth: `requireOrgContext()` + `requireRole()` for privileged mutations,
  `requireOrg()` for read-only reads — complementary by design, not a
  duplicate. The one real inconsistency (owner-only vs member scoping on the
  polling routes) was fixed in Phase 4 via the shared `callerOrgFilter()`.
