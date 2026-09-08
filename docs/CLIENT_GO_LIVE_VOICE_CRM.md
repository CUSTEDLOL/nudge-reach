# Client go-live: voice front desk + CRM — the 30-minute checklist

Use this the day a client goes live. Everything below has been exercised
end to end in simulation and against the built app; the only steps that
touch a live vendor for the first time are marked **first-run**.

## A. Once, for Nudge (platform) — ~15 min

1. ElevenLabs account → **API keys** → create one.
2. `.env.local`: `ELEVENLABS_API_KEY`, `ELEVENLABS_LLM=claude-haiku-4-5`,
   `VOICE_INITIATION_SECRET` and `VOICE_TOOLS_SECRET` (two long random strings),
   `VOICE_TEST_ORG_ID` (the org the **Call your AI** button talks to),
   `NEXT_PUBLIC_APP_URL=https://nudgeagent.app`.
3. **First-run:** run the setup script (command at the top of
   `scripts/voice-setup.ts`). It creates the shared agent, the three webhook
   tools and the post-call webhook, and points the workspace at the
   initiation + post-call webhooks. It prints `ELEVENLABS_AGENT_ID` and
   `ELEVENLABS_WEBHOOK_SECRET` → add both to `.env.local`. If it errors, the
   message names the field — send it to Nudge engineering before touching the
   dashboard. (Done 2026-09-07 for the Nudge workspace.)
4. `bash scripts/voice-push-env.sh` → copies those values into Vercel
   production and deploys. `SEND_MODE=live` in Vercel is a separate switch for
   the WhatsApp side.
5. Verify in 60 seconds (any terminal):
   ```
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://nudgeagent.app/api/voice/initiation -d '{}'   # 401
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://nudgeagent.app/api/voice/post-call  -d '{}'   # 401 (503 = webhook secret missing)
   ```

## B. Per client — voice — ~10 min

1. Plan: `npm run plan:set -- --org <owner-email> --plan front_desk`
   (100 call minutes/month included). Bespoke minutes:
   `npm run voice:minutes -- --org <owner-email> --minutes 300`.
2. Number. **India:** Exotel account + KYC for the client's city, ask
   hello@exotel.com for vSIP trunking, buy an Exophone, point the trunk at
   `sip.rtc.elevenlabs.io:5060` (TLS). **Elsewhere:** a Twilio number.
   In ElevenLabs → Phone numbers → import it → assign the Nudge agent →
   note the phone-number id.
3. Nudge → the client's workspace → Settings → **Voice** → *Add or update a
   number*: the number, carrier, language (English or Hindi/Hinglish), the
   transfer number (their receptionist's mobile), the ElevenLabs phone-number id.
4. Knowledge: the AI answers only from what's on **AI Agent → Knowledge**.
   Hours, prices, services, address, booking policy must be there. Ask it
   "how much is a consultation?" on **Settings → Voice → Call your AI**
   (set `VOICE_TEST_ORG_ID` to this workspace's org id for that button).
5. **Reminder calls stay off** unless the client asks (Settings → Voice).

### The 5-minute live test (do it on the client's line, with them)
| Say | Expect |
|---|---|
| "Hi, what are your hours?" | Hours from their knowledge base, one or two sentences, no reading of lists |
| "How much is a consultation?" | The price, spoken in words |
| "Do you offer <something not in the knowledge>?" | "The team will check and get back to you" — never a guess; a question appears in AI Agent → Questions |
| "Book me for tomorrow at five, name Priya" | Confirms name + time once, then "the team will confirm shortly"; a booking appears on the Dashboard |
| "I want to speak to a person" | "Let me connect you" and the call transfers to the number set in step 3 |
| "Thanks, bye" | Short goodbye, call ends |
| Afterwards | The call sits in **Chats** with a "Phone call" chip and the transcript; Settings → Voice shows minutes used |

If any row fails, the transcript in Chats shows exactly what the AI heard and said — send that.

## C. Per client — CRM — ~5 min

1. Once, for Nudge: Zoho API console server-based client (redirect
   `https://nudgeagent.app/api/integrations/crm/zoho/callback`) and/or a
   Salesforce Connected App; put `ZOHO_CLIENT_ID/SECRET`,
   `SALESFORCE_CLIENT_ID/SECRET` in Vercel. Redeploy.
2. Client → **Integrations → CRM → Connect Zoho CRM** (or Salesforce) →
   they log in and approve → back to Integrations showing *Connected*.
   Zoho asks for the search scope too — that is expected.
3. Test: message the business on WhatsApp from a new number. Within ten
   minutes (the sync tick) a new Lead appears in their CRM with source
   "WhatsApp (Nudge)"; the Integrations page's sync log shows `contact.created`
   as done. Change that lead's stage in Nudge → the CRM stage updates.
4. What syncs: new leads, stage changes (not LOST), bookings, payments,
   hand-offs, opt-outs, daily summaries. Imported/hand-added contacts do not.

## D. What to tell the client
- Calls are answered by AI and say so; the call may be recorded.
- The number stops answering when the month's minutes are used up; WhatsApp
  keeps working. Nudge can raise the allowance the same day.
- Their CRM stays theirs — Nudge only writes, never edits their pipeline.
