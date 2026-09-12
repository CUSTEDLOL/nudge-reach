# Founder WhatsApp Connection Design

**Date:** 2026-09-12

## Context

Workspace owners can already enter WhatsApp Cloud API credentials from their own
settings. The founder portal can inspect connected numbers, choose a default, and
disconnect them, but it cannot establish a connection for a client. That leaves a
gap in Nudge's done-for-you onboarding model.

## Goal

Allow a Nudge founder to connect or refresh a client's official Meta WhatsApp
Cloud API number from the founder portal, while keeping credentials protected and
the workspace in its existing send mode until a founder explicitly changes it.

## Non-goals

- Building Meta Embedded Signup in this iteration.
- Letting client workspace roles use the founder endpoint.
- Sending a live WhatsApp message as part of credential setup.
- Supporting unofficial WhatsApp automation providers.

## Approaches considered

### 1. Keep setup in the client workspace

This already works, but it requires the client to handle Meta IDs and tokens and
does not support concierge onboarding well.

### 2. Add Meta Embedded Signup now

This is the best long-term client experience, but it requires Meta app review and
additional OAuth/onboarding infrastructure. It is larger than the immediate
founder-operated need.

### 3. Founder-only validated connection form (selected)

Add a compact connection form to each organization's Integrations page. Validate
the token, WABA, and phone-number relationship with Meta before saving. Reuse the
existing encrypted per-organization credential store and audit trail.

This is the smallest safe path for the current manual onboarding phase and does
not prevent Embedded Signup later.

## Experience

On `/admin/orgs/[id]/integrations`, the WhatsApp section gains a “Connect a
number” form with:

- Display name
- WhatsApp Business Account ID
- Phone Number ID
- Permanent/system-user access token
- Required founder reason

Submitting opens the existing confirmation experience. The confirmation explains
that Meta will be contacted, the secret will not be shown again, and the
workspace will not be switched to live sending by this action.

On success, the number appears in the existing account list. A founder uses the
separate workspace Controls page to enable live mode explicitly.

## Architecture and data flow

1. A Server Action reads the form and enters `runFounderAction`, so server-side
   founder authorization is mandatory.
2. The admin integration service validates the founder reason and verifies that
   the target organization exists.
3. A WhatsApp connection validator checks bounded input formats.
4. In normal operation, it queries Meta's official Graph API for the WABA's phone
   numbers and requires the submitted Phone Number ID to be present.
5. In simulation mode, it performs deterministic local validation without
   external keys or network access.
6. The existing WhatsApp account service encrypts and upserts the token. A new
   option prevents this founder path from changing the organization's send mode.
7. An awaited founder audit event records the actor, target organization, number
   identifiers, and reason. It never records the token.
8. The route revalidates the organization pages and returns a safe UI result.

## Security and product invariants

- Only official Meta Cloud API endpoints are used.
- The founder endpoint authorizes on the server; hiding the UI is not relied on.
- Access tokens are password inputs, never returned to the page, never included
  in audit detail, and encrypted using the existing credential storage path.
- Meta errors are mapped to stable, non-secret UI messages.
- No message is sent, so consent and 24-hour-window gates remain untouched.
- Simulation mode works without Meta credentials or a network call.
- The account is always scoped to the selected organization.
- Connecting credentials does not silently make a test workspace live.

## Error behavior

- Invalid fields: show a field-safe validation message and save nothing.
- Rejected token/WABA: explain that Meta rejected the credentials and save
  nothing.
- Phone number absent from the WABA: explain the mismatch and save nothing.
- Meta unavailable: show a retryable message and save nothing.
- Duplicate number in another organization: preserve the existing ownership
  conflict response.
- Unexpected failures: use the founder action wrapper's stable error response.

## Testing

- Unit-test simulation and live Meta validation, including token rejection,
  number mismatch, and network failure.
- Unit-test the account option that preserves the organization's send mode.
- Unit-test founder orchestration: reason required, target org required,
  validation before save, no audit on rejected validation, and redacted audit.
- Test the Server Action form mapping and safe result behavior.
- Run the full test suite, lint, production build, and `git diff --check` before
  integration.

## Rollout

Ship the founder form behind the existing founder portal authorization. Continue
using the current per-client Meta setup process for the first clients. Introduce
Embedded Signup as a separate future project after Tech Provider prerequisites
and Meta review are in place.
