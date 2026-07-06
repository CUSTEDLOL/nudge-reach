# DEMO SCRIPT — the 5-minute Nudge sales demo

Audience: a clinic, salon, or shop owner (or their manager) who lives on
WhatsApp but runs it from one phone, one thumb — and loses money every week to
missed replies, no-shows, and leads that go quiet. Goal: land the **AI Front
Desk** as an employee they can hire today, then book a follow-up. Not to show
every feature.

The demo has a spine: **the AI Front Desk is the star; the CRM/inbox/campaign
toolkit is the supporting cast.** The whole thing runs in **simulation** — no
Meta account, no Google account, no external keys. Book a real calendar slot,
fire the follow-ups, all mocked end to end.

---

## Before the demo (prep box — 15 minutes, once)

1. **Node 20** for any local command:
   `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`
2. **Confirm `SEND_MODE=simulation`** (the sidebar shows the simulation pill).
   You do **not** need `GOOGLE_CLIENT_ID/SECRET` — the calendar is mocked in
   simulation. The app's own Anthropic (Haiku) key in `.env.local` is what lets
   the agent think and book; that's the cheap runtime model, not an integration
   the retailer connects.
3. **Fresh checkout only** — apply the new front-desk tables once:
   `npm run db:push && npm run db:rls` (adds `CalendarAccount`, `FollowUpConfig`
   and the new `BookingRequest` fields). Skip if your DB is already migrated.
4. **Seed the toolkit depth** (idempotent — re-running also *restores* the demo
   after a session):

   ```bash
   npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
     --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
   ```

   This gives the "full toolkit underneath": ~40 contacts (tags, stages, 4
   opted-out), 10 staffed conversations, a template library, the **"Diwali
   Dhamaka Sale"** SENT campaign with stats, a SCHEDULED flash sale, 3
   automations with run logs, and teammates Priya + Arjun.
5. **Turn this workspace into an AI Front Desk** (the one-pass concierge flow —
   this is exactly what you do for a real client):
   1. `/settings/concierge` → fill the knowledge base for a demo **clinic** or
      **salon** (hours, services, prices, a couple of FAQs). Pick the vertical.
      Save. This **trains + switches on the AI agent**, installs the vertical
      template pack, and **turns on Revenue Recovery** in one action.
   2. `/integrations` → **Connect calendar**. In simulation this writes a
      *mocked* "connected" Google account — no OAuth, no Google app.
   3. Back on `/settings/concierge`, confirm the **go-live gate is all green**:
      knowledge base, agent on, approved templates, Revenue-Recovery on,
      calendar connected. Green = the client is live.
6. **Browser tabs, in order** (you walk left to right):
   1. `/settings/concierge` 2. `/inbox` 3. `/dashboard` 4. `/automations`
   5. `/campaigns` 6. `/analytics` 7. `/settings/whatsapp`
   Keep one spare tab on `/api/cron/process-queue` — opening it is the "queue
   tick" that advances follow-ups (Vercel Cron does this automatically in prod).
7. **Phone**: app open, logged in, at `/inbox`, screen-mirrored or ready to
   hold up.
8. **Booking-demo tips** (the sim calendar is deterministic):
   - Ask for **1pm** to trigger the "that slot's taken — here are two open
     slots" intelligence, then confirm an alternative.
   - Ask for **any other time** for a clean, instant booking.
   - To make the **T-24h reminder** actually fire in the room, book a slot
     that falls **within the next 24 hours** (e.g. later today / tomorrow
     morning), then open the queue-tick tab.

---

## The script

### 0:00 — The problem (30s, no screen yet)

> "You already run your business on WhatsApp — that's where people ask 'are you
> open?', 'how much?', 'can I come Saturday at 3?'. But it's one phone, one
> person. Messages get missed at 9pm. Appointments slip. Someone books, doesn't
> show, and nobody chases them. A lead asks a price, goes quiet, and you never
> follow up. Every one of those is money walking out the door — and you can't
> hire a person to sit on WhatsApp 24/7 for what that person would cost."

### 0:30 — The one line

> "Nudge is an **AI Front Desk** — a done-for-you AI employee that runs your
> WhatsApp end to end. It answers in seconds, it **books people straight into
> your calendar**, and it chases the revenue you'd otherwise lose. Let me show
> you one already working."

### 0:40 — It's already trained (tab 1: `/settings/concierge`)

**Click path:** `/settings/concierge`. Point, don't type.

- "This is 'Glow Skin Clinic'. Notice I'm not building anything — it's already
  set up. We do this **for** the client: you hand us your hours, services,
  prices, policies; we train the agent on exactly that, and nothing else — so
  it never makes things up."
- Point at the **go-live gate, all green**: knowledge base, AI agent on,
  approved templates, Revenue-Recovery on, Google Calendar connected. "Five
  greens and the front desk is live. That's the whole onboarding — concierge,
  done for you."

### 1:10 — A customer messages, the agent BOOKS (tab 2: `/inbox`)

**Click path:** `/inbox` → open a conversation (or start one) → **Test as
customer** (simulation tester — routes through the exact handler the live
WhatsApp webhook uses).

- Type as the customer: **"Hi! Can I book a facial this Saturday at 1pm?"**
- The agent replies in the clinic's voice — and because 1pm is taken, it says
  **"1pm's booked — I've got 2pm or 3pm free, which works?"** "It didn't guess.
  It **checked the calendar**."
- Reply **"3pm please"** → the agent **books the slot and confirms**: "You're
  booked for Saturday 3pm, see you then — I'll send a reminder."
- Point at the timeline: an **AI Assistant note** appears —
  *"Booking CONFIRMED in calendar."* "That's a real event, on a real calendar,
  created by the AI, with zero staff involvement. This is the moat: Meta's free
  built-in bot can *chat*. It cannot **do the job**. Ours books."
- Say it plainly: "Inside WhatsApp's 24-hour service window the agent replies
  freely, like a person. It never spams — the reminders you're about to see are
  pre-approved templates, and every opt-out is permanent."

### 2:10 — The proof: the event + the dashboard (tab 3: `/dashboard`)

**Click path:** open the calendar event link on the booking (in simulation it's
a mocked Google Calendar event), then `/dashboard`.

- "There's the appointment on the calendar." (In a live client it's *their*
  Google Calendar; in the demo it's the mocked one.)
- On `/dashboard`, point at the **"Bookings this month"** card — it just ticked
  up. "This is the number the owner cares about. Not 'messages sent' —
  **appointments on the book.**"

### 2:40 — Revenue Recovery: the follow-ups fire (tab 4: `/automations`)

**Click path:** open the **queue-tick tab** (`/api/cron/process-queue`) once,
then `/automations`.

- "A booking isn't the end — it kicks off the outbound engine. Watch." Hit the
  queue tick (in production Vercel Cron does this on a schedule).
- Flip back to the customer's thread: the **T-24h reminder** has gone out —
  *"reminder about your appointment tomorrow…"* — automatically, as an approved
  template. Back on `/automations`, the **"follow-ups sent this month"** counter
  moved.
- Now walk the **Revenue Recovery** card + the automation rails — the three
  ways it chases money an inbound-only bot never can:
  - **T-24h (and T-2h) reminder** — every confirmed booking gets nudged before
    it happens. Fewer no-shows.
  - **No-show rebook** — when staff mark a no-show, the next tick sends a warm
    *"we missed you — want a new slot?"* Consent-gated marketing template, one
    chase, then it stops.
  - **Quiet-lead nudge** — someone who asked a price then went silent gets two
    gentle template nudges, three days apart, then we stop. Point at the
    **"Revenue Recovery — quiet-lead nudge"** automation and its run log.
- "Every one of these is a message a human would forget to send. The AI never
  forgets, and every send is consent- and template-compliant — it *can't* get
  your number banned."

### 3:40 — "And underneath, it's a full WhatsApp toolkit" (secondary beat, fast)

**Click path:** `/inbox` → `/campaigns` → `/analytics`, ~15s each. Move quickly
— this is the supporting cast, not the star.

- **Shared inbox + CRM:** "Every chat, every teammate, one screen — with Meta's
  **24-hour window** counted down for you, and every customer on a pipeline
  stage with opt-in consent enforced in code."
- **Campaigns:** open **Diwali Dhamaka Sale** (SENT, with stats) — "upload one
  product photo, get a compliant broadcast with the opt-out line baked in, see
  the **estimated ₹ cost before you send**, then delivered/read/clicked after."
- **Analytics:** "WhatsApp gets ~90% open rates; email gets 20. Here's your
  funnel and agent performance." Then land it: "That's the self-serve product —
  Free, Starter, Growth, Pro. The **AI Front Desk sits on top of all of it.**"

### 4:15 — The go-live story (tab 7: `/settings/whatsapp`, 20s)

**Click path:** `/settings/whatsapp`.

- "Everything you just saw ran in **simulation** — no WhatsApp account, no
  Google account, no keys, so you can evaluate it in five minutes. Going live is
  the same two connections you saw us make: your **business number** here (your
  templates go to Meta for approval, usually minutes to a day) and your **Google
  Calendar**. Official WhatsApp Cloud API only — nothing that risks your
  number."

### 4:35 — The salary math (the close)

> "So here's the decision. A front-desk person in India runs about **₹22,000 a
> month** — and they sleep, take leave, and miss the 9pm messages. The AI Front
> Desk is **₹14,999 a month** — that's S$599 / RM1,199 / $179 in your market —
> and it **never sleeps, never quits, answers in seconds, and books while you're
> closed.** A third of the cost of a human, working every hour of every day.
> One recovered no-show or one lead saved a month more than pays for it."

(Optional: flash the landing page's **salary calculator** at `/#salary` — slide
your local wage and watch the yearly saving.)

### 4:55 — Ask

Ask for the follow-up: "Give me your hours, services and prices, and I'll have
your AI Front Desk trained and booking appointments this week — you just watch
it work. Shall we set that up?"

---

## Objection handling

| Objection | Answer |
|---|---|
| "Will the AI book the wrong time or double-book me?" | It never guesses. It **checks your live calendar** first and only books a genuinely free slot; if the time's taken it offers the open ones and lets the customer pick. Every booking is written as a note in the chat, and staff can take over any conversation with one tap — the AI hands off the moment it's unsure. |
| "Does the AI message my customers on its own? Won't that get me banned?" | Only inside Meta's rules. Within the **24-hour service window** it replies to a customer who just messaged — that's allowed and expected. The reminders and follow-ups are **pre-approved templates**, sent only to opted-in contacts, and **STOP is permanent and enforced in code**. It uses only the **official WhatsApp Cloud API** — no browser bots, ever. That's the opposite of what gets numbers banned. |
| "How is this different from Meta's own free AI on WhatsApp?" | Meta's bot can *chat*. It can't **do the job**. Nudge checks your calendar and **books the appointment**, then runs the outbound engine — reminders, no-show rebooks, quiet-lead nudges — that actually recovers revenue. Chatting is table stakes; booking and chasing is the moat. |
| "₹14,999 is a lot — I could pay a person ₹22,000." | And that person sleeps, takes leave, and misses your 9pm messages. The AI is **a third less**, works **every hour of every day**, answers in seconds, and never has an off day. One recovered no-show or one saved lead a month covers the gap. It doesn't replace your people — it does the front-desk grind so they sell. |
| "I'm not sure I need all that — can I start smaller?" | Yes. The self-serve tiers — Free, Starter, Growth, Pro — give you the shared inbox, CRM, AI-drafted replies and one-photo campaigns. The **AI Front Desk** is the done-for-you flagship on top, with calendar booking and Revenue Recovery. Start where you are; upgrade when you want the employee, not just the toolkit. |
| "Is this official? Will my number get banned?" | Nudge uses only the **official WhatsApp Cloud API** — the same one AiSensy/WATI use. No unofficial automation anywhere. What bans numbers is messaging people without consent — Nudge blocks that in code: opt-outs are permanent and enforced at the send layer. |
| "What if Meta rejects a template?" | You see the rejection **with Meta's reason** right on the campaign, fix the wording, and resubmit — nothing sends until it's approved. Usually minutes to a day. |
| "Can my staff use it without training?" | That's the design bar. Agents get a role that shows **only the inbox and contacts** — no settings, no billing. The AI drafts replies and handles bookings; the 24-hour rule is enforced for them; it works from their phone. If they can use WhatsApp, they can use this. |
