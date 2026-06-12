# PROGRESS — Nudge Reach (WhatsApp)

Build log. Newest phase at the top. Each entry: what was done, decisions made,
what's next.

---

## Phase 0 — Scaffold (2026-06-12) ✅ COMPLETE — verified against live Supabase

### Done
- Git repo initialized; project docs moved from repo root into `docs/`.
- Next.js 16 (App Router) + TypeScript + Tailwind v4 scaffolded.
- Prisma 6 initialized against Supabase Postgres (`prisma/schema.prisma`) with
  the `Org` model (one org per user). `lib/db.ts` Prisma singleton,
  `lib/org.ts` find-or-create org (race-safe).
- `.env.example` with every variable through Phase 4; `lib/env.ts` validates
  env at boot with Zod (imported from `app/layout.tsx`).
- Supabase Auth wired with `@supabase/ssr`: browser/server clients in
  `lib/supabase/`, session refresh in `proxy.ts` (Next 16's renamed
  middleware), email+password and Google OAuth on `/login`, callback/confirm/
  signout routes under `/auth/*`.
- Protected `/dashboard` page: verifies auth with `getClaims()`, creates the
  Org row on first visit, renders "Hello, {org}" — the auth + DB round-trip.
- Vitest set up; first tests cover the env schema (`tests/env.test.ts`).
- `README.md` with setup instructions.

### Decisions (smallest reversible choice where docs were silent)
- **Docs location:** moved `PRD.md`/`BUILD_PLAN.md`/`WHATSAPP_CLOUD_API.md`
  into `docs/` to match the kickoff prompt's expected layout.
- **Auth method:** email+password as primary (works with zero email/SMTP
  config) + Google OAuth button; magic-link can be added later. Both the
  PKCE `/auth/callback` and token-hash `/auth/confirm` routes exist so
  sign-up works regardless of the project's email-confirmation setting.
- **Next 16 conventions:** `proxy.ts` (middleware was renamed in v16);
  Supabase's current guidance followed — publishable key (not legacy anon),
  `getClaims()` for page protection (never `getSession()` server-side).
- **Env validation & live mode:** `SEND_MODE=live` requires all `WHATSAPP_*`
  vars + `TOKEN_ENCRYPTION_KEY` at boot (enforced in `lib/env.ts`, unit
  tested). Validation is skipped during `next build` so CI needs no secrets.
- **Default runtime model:** `claude-haiku-4-5-20251001` (cheapest
  vision-capable Haiku tier) as `RUNTIME_MODEL` default; will be re-verified
  against current model list when building `lib/model-router` in Phase 1.
- **Prisma connections:** pooled `DATABASE_URL` (pgbouncer) for runtime +
  `DIRECT_URL` for migrations, per Supabase guidance.

### Acceptance criteria status
- [x] App builds
- [x] Env validated at boot; `.env.example` complete
- [x] `PROGRESS.md` + `README.md` created
- [x] User can sign in and an Org row is created — verified end to end
      against the live Supabase project (`lgojsxrljjmkwxawocdk`,
      ap-southeast-1) with test account `visheshjain1705+nudgetest@gmail.com`
      via `scripts/verify-phase0.js`

### Post-verification decisions
- **RLS enabled on `Org`** (and required on every future Prisma table):
  Supabase's Data API exposes `public` tables to the publishable key by
  default; RLS with no policies blocks that while Prisma (table owner)
  retains access.
- **`.env` + `.env.local` split:** Prisma CLI only reads `.env`, Next.js
  reads both — DB URLs live in `.env`, everything in `.env.local`. Both
  git-ignored.
- **Supabase MCP connector abandoned** for now (their OAuth client_id is
  broken); using direct connection strings instead.
- **Google OAuth provider not yet enabled** in the Supabase project — the
  login button exists but the founder must enable the provider in
  Supabase → Authentication → Providers (optional; email works).

### Next
- **Phase 1 — Platform modules**: model-router, channel-agnostic messaging
  interface, contacts/opt-in with consent gate (unit-tested), billing stub.
- Needs from founder: `ANTHROPIC_API_KEY` for the live model-router check.
