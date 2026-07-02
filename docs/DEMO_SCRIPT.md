# DEMO SCRIPT — the 5-minute Nudge sales demo

Audience: a shop/restaurant/clinic owner (or their manager) in India who
lives on WhatsApp but runs it from one phone, one thumb. Goal: book a
follow-up or get them started free — not to show every feature.

---

## Before the demo (prep box — 10 minutes, once)

1. **Node 20** for any local command:
   `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`
2. **Seed the demo workspace** (idempotent — re-running it also *restores*
   the demo after a previous session; a one-click demo-reset action is
   landing in a parallel work stream):

   ```bash
   npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
     --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
   ```

   This gives you: ~40 contacts (tags, stages, 4 opted-out), 10 staffed
   conversations, 4 library templates, the **"Diwali Dhamaka Sale"** SENT
   campaign with full stats, a SCHEDULED "Weekend Flash Sale", 3 automations
   (incl. **"Store hours FAQ"** with run logs), and teammates Priya Sharma +
   Arjun Mehta for assignment dropdowns.
3. Confirm `SEND_MODE=simulation` (the sidebar shows the simulation pill).
4. **Browser tabs, in order** (you will walk left to right):
   1. `/dashboard` 2. `/inbox` 3. `/contacts` 4. `/campaigns`
   5. `/automations` 6. `/analytics` 7. `/settings/whatsapp`
5. **Phone**: open the app URL logged in, at `/inbox`, screen-mirrored or
   ready to hold up.
6. If demoing template rejection: remember — a template whose name contains
   `reject` goes down the rejection path (deliberate demo trigger).

---

## The script

### 0:00 — The problem (30s, no screen yet)

> "Your customers are already on WhatsApp — that's where they ask prices,
> confirm orders, complain. But it all sits on one phone: chats get missed,
> nobody knows who replied, broadcasts are copy-paste to 50 people at a
> time, and one wrong bulk message can get your number banned by Meta.
> Nudge puts your whole shop's WhatsApp in one place — inbox, customers,
> campaigns — with Meta's rules enforced for you."

### 0:30 — Dashboard (tab 1)

**Click path:** `/dashboard`. Point, don't click.

- Onboarding checklist card: "Five steps and you're live — connect WhatsApp,
  import contacts, a template, a campaign, an automation."
- Stat row: contacts, open conversations, campaigns sent, delivered/read
  rates.
- **Revenue influenced** card: "customers you closed × your average order
  value — an honest estimate, and it's the number that pays for the tool."

### 1:00 — Shared inbox (tab 2)

**Click path:** `/inbox` → click a conversation with an unread dot.

- "Every chat, every teammate, one screen." Show filters: **Open / Mine /
  Unassigned / Unread**.
- Point at the **24-hour window chip** on the thread: "Meta only allows
  free-text replies for 24 hours after the customer's last message. Nudge
  counts it down; after that it switches you to approved templates — you
  *can't* accidentally break the rule."
- Right panel: assign the chat to **Priya Sharma**, add an internal **note**
  ("Notes are for your team — the customer never sees them").
- **Sim tester**: send an inbound message as the customer ("This is your
  customer texting you right now") — watch it land in the list with an
  unread badge.

### 1:45 — AI reply (same thread)

**Click path:** composer → **Suggest reply** → pick a tone chip
(Professional / Friendly / Short / Persuasive).

- "The AI reads the conversation and your business info, and drafts the
  reply — in your tone."
- **Edit one word, then send.** Say it explicitly: "It drafts, *you* send.
  The AI never messages your customers on its own from the inbox."

### 2:15 — Contacts CRM (tab 3)

**Click path:** `/contacts` → filter by tag **VIP** → open a contact.

- "Every customer with a stage — New, Contacted, Qualified, Won, Lost — so
  WhatsApp becomes a pipeline, not a chat log."
- Show tags, the **opted-in / opted-out consent badges** ("consent is data
  here — opted-out customers are excluded from marketing automatically,
  permanently"), and the profile's merged timeline (chats + campaigns +
  notes).
- Mention segments: "Filters can be saved as a dynamic audience — 'VIP
  festive shoppers' — and campaigned to directly."

### 2:45 — Campaign wizard (tab 4)

**Click path:** `/campaigns` → show **Diwali Dhamaka Sale** row (SENT, with
stats) → **New broadcast**.

- Step 1: "Upload one product photo — the AI writes a complete,
  Meta-compliant campaign: headline, message, buttons, opt-out footer.
  Non-negotiables like the opt-out line can't even be edited away."
- Step 2: pick audience **Festive shoppers** — show the opted-in count and
  the **estimated cost in ₹** before anything sends.
- Step 3: the compliance interstitial — "You confirm these contacts opted
  in. We enforce it in code too, but Meta bans buyers of contact lists, so
  we make it explicit." Send now or schedule.
- Flip back to the sent campaign's page: live delivered/read/clicked bars +
  actual cost. "This is what you check the next morning."

### 3:30 — Automation (tab 5)

**Click path:** `/automations` → open **Store hours FAQ**.

- "Customer asks 'timing?' at 11pm — this answers instantly." Show trigger
  (keyword) → steps.
- Hit **Test run** against a contact; open the run log ("every step,
  logged").
- One line on the others: "Welcome message for new contacts, VIPs
  auto-routed to your best person."

### 4:00 — Analytics (tab 6)

**Click path:** `/analytics`.

- Delivery/read/reply rates ("WhatsApp gets ~90%+ open rates — email gets
  20"), campaign performance table, **agent performance** (who resolves,
  how fast they first respond), and the lead **funnel**.

### 4:20 — The go-live story (tab 7, 20s)

**Click path:** `/settings/whatsapp`.

- "Everything you just saw ran in simulation — no WhatsApp account needed to
  evaluate. Going live: you connect *your* business number right here, your
  templates go to Meta for approval — usually minutes to a day — and the
  same campaigns send for real. Official WhatsApp Cloud API only; nothing
  that risks your number."

### 4:40 — Mobile (the phone)

Hold up the phone at `/inbox`: "Your staff run this from their phones on the
shop floor — same inbox, same rules."

### 4:50 — Close

> "Plans run ₹999 to ₹5,999 a month. One recovered sale — one 'is this in
> stock?' answered at 11pm — pays for the month. You start **free, in
> simulation, today**: import your contacts, build your first campaign, and
> go live when Meta approves your number."

Ask for the follow-up: "Want me to set up your workspace with your own
catalogue this week?"

---

## Objection handling

| Objection | Answer |
|---|---|
| "Is this official? Will my number get banned?" | Nudge uses only the **official WhatsApp Cloud API** — the same one AiSensy/WATI use. No browser bots, no unofficial automation, anywhere. What gets numbers banned is messaging people without consent — and Nudge blocks that in code: opt-outs are permanent and enforced at the send layer itself. |
| "What if Meta rejects my template?" | You see the rejection **with Meta's reason** right on the campaign, fix the wording, and resubmit — the campaign returns to draft, nothing sends until it's approved. Approval usually takes minutes to a day. |
| "What does it cost per message?" | Two parts: Meta charges per marketing conversation (~₹0.99 today — Nudge shows the **estimated ₹ cost before you send** and the actual cost after), plus the Nudge subscription (Free to try, then ₹999/₹2,499/₹5,999 monthly). No per-message markup from us. |
| "Can my staff use it without training?" | That's the design bar. Agents get a role that shows **only the inbox and contacts** — no settings, no billing, nothing to break. The AI drafts replies for them, the 24-hour rule is enforced automatically, and it works from their phone. If they can use WhatsApp, they can use this. |
