# Per-workspace WhatsApp app connections

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Treat Nudge's business as the first ordinary client, with independently stored Meta credentials and verified inbound routing.
**Architecture:** One client-owned Meta app per workspace, shared by that workspace's existing multiple numbers. Add WhatsappConnection (unique orgId/appId, encrypted app secret and verification token, random callback key, verification/receipt timestamps). Existing encrypted account tokens stay per number. An opaque callback resolves its connection before checking HMAC; all number/WABA, status and template lookups are org-scoped. The legacy callback only serves workspaces without a verified dedicated connection, allowing a staged migration. A handshake activates the dedicated connection and excludes legacy routing. Settings separates saved credentials, verified callback and actual receipt. No per-client Vercel edits.
**Tech Stack:** Next.js, Prisma/Postgres, existing AES-256-GCM encryption, Vitest.

Approved scope: manual client-owned apps now; shared-platform Embedded Signup remains a later Tech Provider milestone. No changes to consent, sending windows, runtime models, simulation or agent scope.

## Tasks
1. Add failing tests for app credential isolation, encryption, rotation and role enforcement; add schema and scoped connection persistence. Use one additive SQL transaction with RLS enabled and no client grants. Run focused tests.
2. Add failing webhook tests for wrong/malformed signatures, foreign WABA/phone, cross-org statuses/templates, verification and real receipt. Extract the existing processing into a module, scope all lookups, add dedicated route, restrict legacy route after activation. Preserve dedupe and batch resilience.
3. Add admin-only workspace app settings and copyable webhook details, numbered setup guidance and independent statuses. Preserve existing token/number flow; existing Nudge credentials need not be re-entered. Remove mandatory global webhook secrets from live environment validation (legacy route fails closed without them).
4. Run focused/full tests, lint and production build; review diff and record PROGRESS. Commit only this work.
5. Apply additive schema before deployment, migrate Nudge's app securely, configure its dedicated webhook and verify real inbound delivery. Never export all deployment secrets; if the existing app secret cannot be read securely, use the new authenticated settings form. Report any remaining external prerequisite explicitly.

## Rollout / rollback
Apply scripts/sql/2026-09-26-whatsapp-connections.sql before deploying. Existing callback remains active until dedicated handshake succeeds. Secret changes clear verification and receipt. New credentials never fall back to global signature validation once activated (activeAt stays set). Roll back code only before migrating callbacks; afterward restore callbacks deliberately, not by accepting multiple secrets. Keep this table on rollback; it is additive.
