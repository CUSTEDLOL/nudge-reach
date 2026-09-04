# Nudge Developer API (v1)

REST API for integrating your own systems with Nudge. Available on the Growth
plan and above.

## Authentication

Create an API key under **Integrations → API keys**, then pass it on every
request:

```
Authorization: Bearer nk_live_…
```

- Keys grant full workspace access (scoped keys are planned).
- 120 requests/minute per key; `429` responses carry a `Retry-After` header.
- Errors are JSON: `{ "error": { "status": 422, "message": "…" } }`.

Check your wiring:

```bash
curl -s https://nudgeagent.app/api/v1/me -H "Authorization: Bearer $KEY"
```

## Pagination

List endpoints return up to 50 rows plus `next_cursor`. Pass it back as
`?cursor=<id>` to continue; `next_cursor: null` means you have everything.

## Endpoints

### `GET /api/v1/me`
Workspace identity for the key: `{ org: { id, name, plan }, scopes }`.

### `GET /api/v1/contacts?cursor=&stage=`
Contacts, newest first. `stage` filters by `NEW | CONTACTED | QUALIFIED | WON | LOST`.

### `POST /api/v1/contacts`
```json
{ "name": "Priya Shah", "phone": "98765 43210", "email": "p@x.com", "opt_in": true, "lead_stage": "NEW" }
```
Phone is normalized to E.164 using your workspace's country. If the phone
already exists this updates name/email/stage and returns `200` (a new contact
returns `201`). **Consent rules:** `opt_in` applies only when the contact is
created — updating an existing contact never changes consent, and an opted-out
contact can never be opted back in via the API.

### `GET /api/v1/contacts/{id}` · `PATCH /api/v1/contacts/{id}`
PATCH accepts `name`, `email`, `lead_stage`. Consent fields are not writable.

### `GET /api/v1/conversations?cursor=&status=`
Conversations, most recently active first.

### `GET /api/v1/conversations/{id}/messages?cursor=`
Messages in a thread, oldest first.

### `POST /api/v1/messages`
Free-form (only inside the 24-hour service window after the customer's last
message — outside it you get a `422`):
```json
{ "contact_id": "…", "text": "Your order is ready!" }
```
Template (any time; must be Meta-approved; marketing templates require the
contact's opt-in or you get a `403`):
```json
{ "phone": "+919876543210", "template_id": "…", "body_params": ["Priya"] }
```
Returns `{ data: { provider_message_id, conversation_id } }`.

### `GET /api/v1/templates`
Your standalone templates with Meta approval status — only `APPROVED` ones can send.

### `GET /api/v1/bookings?cursor=&status=`
Booking requests (`pending | confirmed | declined | no_show | completed`).

## Webhooks (Nudge → you)

Configure endpoints under **Integrations → Outbound webhooks**. Events:
`message.received`, `message.sent`, `campaign.completed`, `contact.created`,
`booking.created`, `conversation.assigned`, `automation.run`.

Each delivery is signed:

```
X-Nudge-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed by your whsec_ secret>
```

Verify (Node):

```js
const crypto = require("node:crypto");
const expected = "sha256=" + crypto.createHmac("sha256", process.env.WHSEC).update(rawBody).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers["x-nudge-signature"]));
```

Payload shape: `{ "event": "message.received", "createdAt": "…ISO…", "data": { … } }`.
Respond `2xx` quickly; anything else is logged as a failed delivery (no retries yet).

## Test mode

Everything above works in simulation (before your WhatsApp number is live):
sends return `sim-…` provider message ids and nothing leaves the platform.
