# Voice Front Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (founder mandate: inline execution by Fable, NO subagent delegation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI Front Desk answers the business's phone number and makes reminder / no-show calls, using the same knowledge and tools as the WhatsApp agent, with every call filed into the inbox.

**Architecture:** ElevenLabs Agents does speech + the conversation loop (LLM pinned to a Haiku/Sonnet-class Claude in its config); our server provides per-call context (initiation webhook), executes every action (webhook tools → existing `runTool`), and receives the transcript (post-call webhook). Carriers: Exotel SIP (India), Twilio (SG/MY/UAE). A simulation driver keeps test-mode orgs and `/demo` working with zero keys. New module `src/modules/voice/`, three API routes, one settings page, one cron tick.

**Tech Stack:** Existing only — Next.js 16 App Router, Prisma 6, zod, vitest, `lib/crypto` (AES-GCM), `lib/model-router/guard`. No new npm deps. New env vars listed in Global Constraints.

**Spec:** `docs/superpowers/specs/2026-08-29-voice-and-crm-design.md` (Part A)

## Global Constraints

- All 7 `AGENTS.md` invariants hold. Voice actions run only through `runTool` (org-scoped `ToolContext`); no new send paths.
- `ELEVENLABS_LLM` is validated with `assertRuntimeModelAllowed` at setup and boot (Opus/Fable/Mythos rejected).
- Simulation: with no `ELEVENLABS_*` keys, or for an org where `isSimulated(org)` is true, `drivers/simulation.ts` is used and nothing leaves the box.
- Tenant isolation: every route resolves the org from `VoiceNumber.phoneE164` (`called_number`) or from the signed `dynamic_variables.org_id`, never from the request body alone; every Prisma query is `orgId`-scoped.
- Outbound calls skip contacts with `optedOutAt` set and run only inside 09:00–20:00 in `Org.timezone`.
- New env (all optional): `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `ELEVENLABS_LLM` (default `claude-haiku-4-5`), `VOICE_INITIATION_SECRET`, `VOICE_TOOLS_SECRET`. Add each to `.env.example` with a one-line comment.
- Green at every commit: `npx vitest run`, `npm run lint`, `npx tsc --noEmit`; `npm run build` before the final commit. Schema tasks end with `npm run db:push && npm run db:rls`.
- Commit author: `git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit …` (Hobby deploy rule).

---

### Task 1: Schema, env and model guard

**Files:**
- Modify: `prisma/schema.prisma` (add two models; add `channel` to `Conversation`; add `reminderCalls` to `FollowUpConfig`)
- Modify: `src/lib/env-schema.ts:18-36`
- Modify: `.env.example`
- Test: `tests/env-voice.test.ts`

**Interfaces:**
- Produces: Prisma models `VoiceNumber`, `VoiceCall` (fields exactly as in spec §A4); `Conversation.channel: string` (`"whatsapp" | "voice"`); `FollowUpConfig.reminderCalls: boolean`; env keys above.

- [ ] **Step 1: Write the failing test**

```ts
// tests/env-voice.test.ts
import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env-schema";

describe("voice env", () => {
  it("defaults ELEVENLABS_LLM to a cheap model and keeps voice keys optional", () => {
    const parsed = envSchema.parse({ SEND_MODE: "simulation" });
    expect(parsed.ELEVENLABS_LLM).toBe("claude-haiku-4-5");
    expect(parsed.ELEVENLABS_API_KEY).toBeUndefined();
  });

  it("rejects an expensive voice model", () => {
    expect(() =>
      envSchema.parse({ SEND_MODE: "simulation", ELEVENLABS_LLM: "claude-opus-5" })
    ).toThrow(/expensive/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/env-voice.test.ts`
Expected: FAIL — `ELEVENLABS_LLM` is not in the schema (`undefined` !== `"claude-haiku-4-5"`).

- [ ] **Step 3: Add the schema + env**

In `prisma/schema.prisma` append after `model CalendarAccount`:

```prisma
model VoiceNumber {
  id            String   @id @default(cuid())
  orgId         String
  org           Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  phoneE164     String   @unique
  provider      String
  elevenPhoneId String?
  label         String   @default("Main line")
  transferTo    String?
  language      String   @default("en")
  voiceId       String?
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([orgId])
}

model VoiceCall {
  id             String    @id @default(cuid())
  orgId          String
  org            Org       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId      String?
  conversationId String?
  direction      String
  fromE164       String
  toE164         String
  providerCallId String?   @unique
  status         String    @default("in_progress")
  durationSecs   Int?
  transcript     Json?
  summary        String?
  outcome        String?
  purpose        String    @default("inbound")
  startedAt      DateTime  @default(now())
  endedAt        DateTime?

  @@index([orgId, startedAt])
}
```
Add `voiceNumbers VoiceNumber[]` and `voiceCalls VoiceCall[]` to `model Org`; add `channel String @default("whatsapp")` to `model Conversation` (after `contactId`); add `reminderCalls Boolean @default(false)` to `model FollowUpConfig` (after `leadNudge`).

In `src/lib/env-schema.ts`, inside the `z.object({...})` after `WHATSAPP_MARKETING_RATE_INR`:

```ts
    // Voice (ElevenLabs Agents + carrier). All optional: without them every org
    // uses the simulation voice driver.
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_AGENT_ID: z.string().optional(),
    ELEVENLABS_WEBHOOK_SECRET: z.string().optional(),
    ELEVENLABS_LLM: z
      .string()
      .default("claude-haiku-4-5")
      .superRefine((model, ctx) => {
        try {
          assertRuntimeModelAllowed(model);
        } catch (e) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
        }
      }),
    VOICE_INITIATION_SECRET: z.string().optional(),
    VOICE_TOOLS_SECRET: z.string().optional(),
```
and at the top: `import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";`

In `.env.example` append:

```
# Voice (optional — leave empty to keep the simulation voice driver)
ELEVENLABS_API_KEY=""
ELEVENLABS_AGENT_ID=""            # printed by scripts/voice-setup.ts
ELEVENLABS_WEBHOOK_SECRET=""      # post-call webhook HMAC secret from the ElevenLabs dashboard
ELEVENLABS_LLM="claude-haiku-4-5" # model ElevenLabs runs for calls; Opus/Fable rejected by the guard
VOICE_INITIATION_SECRET=""        # header secret ElevenLabs sends to /api/voice/initiation
VOICE_TOOLS_SECRET=""             # bearer secret for /api/voice/tools/*
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/env-voice.test.ts && npx prisma validate`
Expected: PASS (2 tests); `The schema is valid`.

- [ ] **Step 5: Push schema + RLS, commit**

```bash
npm run db:push && npm run db:rls
git add prisma/schema.prisma src/lib/env-schema.ts .env.example tests/env-voice.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): VoiceNumber/VoiceCall models, conversation channel, voice env + guard"
```

---

### Task 2: Pure call-initiation builder

**Files:**
- Create: `src/modules/voice/types.ts`
- Create: `src/modules/voice/initiation.ts`
- Test: `tests/voice-initiation.test.ts`

**Interfaces:**
- Produces:
```ts
// types.ts
export interface CallInitInput {
  org: { id: string; timezone: string };
  number: { phoneE164: string; language: string; voiceId: string | null; transferTo: string | null };
  profile: { vertical: string; businessName: string; businessInfo: string; tone: string; doNots: string };
  knowledgeDigest: string;
  contact: { name: string; phoneE164: string };
  purpose: "inbound" | "reminder" | "no_show";
  booking?: { requestedFor: string; name: string };
  now: Date;
}
export interface CallInit {
  dynamic_variables: Record<string, string>;
  conversation_config_override: {
    agent: { prompt: { prompt: string }; first_message: string; language: string };
    tts?: { voice_id: string };
  };
}
```
- `buildCallInit(input: CallInitInput): CallInit` in `initiation.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-initiation.test.ts
import { describe, expect, it } from "vitest";
import { buildCallInit } from "@/modules/voice/initiation";

const base = {
  org: { id: "org1", timezone: "Asia/Kolkata" },
  number: { phoneE164: "+918000000001", language: "en", voiceId: null, transferTo: "+919800000000" },
  profile: { vertical: "clinic", businessName: "BrightSmile Dental", businessInfo: "", tone: "Warm", doNots: "" },
  knowledgeDigest: "- Hours: Mon–Sat 9am–7pm\n- Consultation ₹500",
  contact: { name: "+919876543210", phoneE164: "+919876543210" },
  purpose: "inbound" as const,
  now: new Date("2026-09-01T04:30:00Z"),
};

describe("buildCallInit", () => {
  it("greets as the business, carries the knowledge digest and tenant ids", () => {
    const init = buildCallInit(base);
    expect(init.conversation_config_override.agent.first_message).toContain("BrightSmile Dental");
    expect(init.conversation_config_override.agent.prompt.prompt).toContain("Consultation ₹500");
    expect(init.conversation_config_override.agent.prompt.prompt).toContain("You are on a phone call");
    expect(init.dynamic_variables.org_id).toBe("org1");
    expect(init.dynamic_variables.contact_phone).toBe("+919876543210");
    expect(init.dynamic_variables.transfer_to).toBe("+919800000000");
    expect(init.conversation_config_override.agent.language).toBe("en");
    expect(init.conversation_config_override.tts).toBeUndefined();
  });

  it("uses Hindi + the configured voice and a reminder opener for reminder calls", () => {
    const init = buildCallInit({
      ...base,
      number: { ...base.number, language: "hi", voiceId: "voice_123" },
      purpose: "reminder",
      booking: { requestedFor: "tomorrow 5pm", name: "Rahul" },
    });
    expect(init.conversation_config_override.agent.language).toBe("hi");
    expect(init.conversation_config_override.tts).toEqual({ voice_id: "voice_123" });
    expect(init.conversation_config_override.agent.first_message).toContain("Rahul");
    expect(init.conversation_config_override.agent.first_message).toContain("tomorrow 5pm");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-initiation.test.ts`
Expected: FAIL — cannot resolve `@/modules/voice/initiation`.

- [ ] **Step 3: Implement**

```ts
// src/modules/voice/types.ts
export interface CallInitInput {
  org: { id: string; timezone: string };
  number: { phoneE164: string; language: string; voiceId: string | null; transferTo: string | null };
  profile: { vertical: string; businessName: string; businessInfo: string; tone: string; doNots: string };
  knowledgeDigest: string;
  contact: { name: string; phoneE164: string };
  purpose: "inbound" | "reminder" | "no_show";
  booking?: { requestedFor: string; name: string };
  now: Date;
}

export interface CallInit {
  dynamic_variables: Record<string, string>;
  conversation_config_override: {
    agent: { prompt: { prompt: string }; first_message: string; language: string };
    tts?: { voice_id: string };
  };
}

export interface PostCallTurn {
  role: "agent" | "user";
  message: string;
  t: number;
  toolCalls: string[];
}

export interface PostCall {
  providerCallId: string;
  agentId: string;
  direction: "inbound" | "outbound";
  fromE164: string;
  toE164: string;
  durationSecs: number;
  transcript: PostCallTurn[];
  summary: string | null;
  callSuccessful: boolean;
  dynamicVariables: Record<string, string>;
}

export interface VoiceDriver {
  outboundCall(input: {
    agentPhoneNumberId: string;
    toE164: string;
    init: CallInit;
  }): Promise<{ ok: boolean; providerCallId?: string; error?: string }>;
}
```

```ts
// src/modules/voice/initiation.ts
import { buildAgentSystemPrompt } from "@/modules/agent/prompt";
import type { CallInit, CallInitInput } from "@/modules/voice/types";

const PHONE_RULES = [
  "You are on a phone call, not a chat. Speak in short sentences (under 20 words).",
  "Never read out lists longer than three items; offer to send details on WhatsApp instead.",
  "Confirm names, dates and phone numbers back to the caller before saving them.",
  "If the caller asks for a person, or you cannot help after two attempts, use transfer_to_number.",
  "When the caller is done, say goodbye and use end_call.",
].join("\n");

function opener(input: CallInitInput): string {
  const biz = input.profile.businessName;
  if (input.purpose === "reminder" && input.booking) {
    return `Hi ${input.booking.name}, this is ${biz} calling to confirm your appointment ${input.booking.requestedFor}. Does that still work for you?`;
  }
  if (input.purpose === "no_show" && input.booking) {
    return `Hi ${input.booking.name}, this is ${biz}. We missed you ${input.booking.requestedFor} — would you like to pick a new time?`;
  }
  return `Hello, you've reached ${biz}. How can I help you today?`;
}

export function buildCallInit(input: CallInitInput): CallInit {
  const prompt =
    buildAgentSystemPrompt(input.profile, {
      knowledgeDigest: input.knowledgeDigest,
      now: input.now,
      timezone: input.org.timezone,
      withTools: true,
    }) +
    "\n\n" +
    PHONE_RULES;

  const init: CallInit = {
    dynamic_variables: {
      org_id: input.org.id,
      contact_phone: input.contact.phoneE164,
      contact_name: input.contact.name,
      business_name: input.profile.businessName,
      transfer_to: input.number.transferTo ?? "",
      purpose: input.purpose,
    },
    conversation_config_override: {
      agent: { prompt: { prompt }, first_message: opener(input), language: input.number.language },
    },
  };
  if (input.number.voiceId) init.conversation_config_override.tts = { voice_id: input.number.voiceId };
  return init;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-initiation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice/types.ts src/modules/voice/initiation.ts tests/voice-initiation.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): per-call initiation builder (prompt, opener, language, voice)"
```

---

### Task 3: Pure post-call parser + outcome

**Files:**
- Create: `src/modules/voice/transcript.ts`
- Test: `tests/voice-transcript.test.ts`

**Interfaces:**
- Produces: `parsePostCall(raw: unknown): PostCall | null`; `outcomeOf(t: PostCallTurn[]): "booked" | "lead" | "handoff" | "info"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-transcript.test.ts
import { describe, expect, it } from "vitest";
import { outcomeOf, parsePostCall } from "@/modules/voice/transcript";

const payload = {
  type: "post_call_transcription",
  event_timestamp: 1787990000,
  data: {
    agent_id: "agent_1",
    conversation_id: "conv_abc",
    status: "done",
    transcript: [
      { role: "agent", message: "Hello, you've reached BrightSmile.", time_in_call_secs: 0, tool_calls: null },
      { role: "user", message: "Book me tomorrow at 5", time_in_call_secs: 4, tool_calls: null },
      { role: "agent", message: "Done, see you tomorrow.", time_in_call_secs: 9,
        tool_calls: [{ tool_name: "capture_booking_request", params_as_json: "{}" }] },
    ],
    metadata: {
      start_time_unix_secs: 1787989900, call_duration_secs: 42,
      phone_call: { direction: "inbound", external_number: "+919876543210", agent_number: "+918000000001", call_sid: "x" },
    },
    analysis: { transcript_summary: "Booked for tomorrow 5pm.", call_successful: "success" },
    dynamic_variables: { org_id: "org1", contact_phone: "+919876543210", purpose: "inbound" },
  },
};

describe("parsePostCall", () => {
  it("normalises the ElevenLabs payload", () => {
    const call = parsePostCall(payload)!;
    expect(call.providerCallId).toBe("conv_abc");
    expect(call.direction).toBe("inbound");
    expect(call.fromE164).toBe("+919876543210");
    expect(call.toE164).toBe("+918000000001");
    expect(call.durationSecs).toBe(42);
    expect(call.transcript).toHaveLength(3);
    expect(call.transcript[2].toolCalls).toEqual(["capture_booking_request"]);
    expect(call.summary).toBe("Booked for tomorrow 5pm.");
    expect(call.callSuccessful).toBe(true);
    expect(call.dynamicVariables.org_id).toBe("org1");
  });

  it("returns null for non-transcription events", () => {
    expect(parsePostCall({ type: "post_call_audio", data: {} })).toBeNull();
  });
});

describe("outcomeOf", () => {
  it("ranks booked > handoff > lead > info", () => {
    const call = parsePostCall(payload)!;
    expect(outcomeOf(call.transcript)).toBe("booked");
    expect(outcomeOf([{ role: "agent", message: "", t: 0, toolCalls: ["transfer_to_number"] }])).toBe("handoff");
    expect(outcomeOf([{ role: "agent", message: "", t: 0, toolCalls: ["capture_lead"] }])).toBe("lead");
    expect(outcomeOf([{ role: "agent", message: "hi", t: 0, toolCalls: [] }])).toBe("info");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-transcript.test.ts`
Expected: FAIL — cannot resolve `@/modules/voice/transcript`.

- [ ] **Step 3: Implement**

```ts
// src/modules/voice/transcript.ts
import { z } from "zod";
import type { PostCall, PostCallTurn } from "@/modules/voice/types";

const turnSchema = z.object({
  role: z.enum(["agent", "user"]),
  message: z.string().nullable().default(""),
  time_in_call_secs: z.number().default(0),
  tool_calls: z.array(z.object({ tool_name: z.string() })).nullable().optional(),
});

const payloadSchema = z.object({
  type: z.literal("post_call_transcription"),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string(),
    transcript: z.array(turnSchema).default([]),
    metadata: z.object({
      call_duration_secs: z.number().default(0),
      phone_call: z
        .object({
          direction: z.enum(["inbound", "outbound"]).default("inbound"),
          external_number: z.string().default(""),
          agent_number: z.string().default(""),
        })
        .optional(),
    }),
    analysis: z
      .object({
        transcript_summary: z.string().nullable().optional(),
        call_successful: z.string().nullable().optional(),
      })
      .optional(),
    dynamic_variables: z.record(z.unknown()).default({}),
  }),
});

export function parsePostCall(raw: unknown): PostCall | null {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data.data;
  const phone = d.metadata.phone_call;
  const dynamicVariables = Object.fromEntries(
    Object.entries(d.dynamic_variables).map(([k, v]) => [k, String(v ?? "")])
  );
  const transcript: PostCallTurn[] = d.transcript.map((t) => ({
    role: t.role,
    message: t.message ?? "",
    t: t.time_in_call_secs,
    toolCalls: (t.tool_calls ?? []).map((c) => c.tool_name),
  }));
  const direction = phone?.direction ?? "inbound";
  // For inbound calls the customer is the external number; for outbound we dialled them.
  const customer = phone?.external_number || dynamicVariables.contact_phone || "";
  const business = phone?.agent_number || "";
  return {
    providerCallId: d.conversation_id,
    agentId: d.agent_id,
    direction,
    fromE164: direction === "inbound" ? customer : business,
    toE164: direction === "inbound" ? business : customer,
    durationSecs: d.metadata.call_duration_secs,
    transcript,
    summary: d.analysis?.transcript_summary ?? null,
    callSuccessful: d.analysis?.call_successful === "success",
    dynamicVariables,
  };
}

export function outcomeOf(turns: PostCallTurn[]): "booked" | "lead" | "handoff" | "info" {
  const tools = new Set(turns.flatMap((t) => t.toolCalls));
  if (tools.has("capture_booking_request")) return "booked";
  if (tools.has("transfer_to_number") || tools.has("handoff_to_human")) return "handoff";
  if (tools.has("capture_lead")) return "lead";
  return "info";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-transcript.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice/transcript.ts tests/voice-transcript.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): post-call transcript parser + outcome"
```

---

### Task 4: ElevenLabs driver (signature verify, outbound call) + simulation driver

**Files:**
- Create: `src/modules/voice/drivers/elevenlabs.ts`
- Create: `src/modules/voice/drivers/simulation.ts`
- Create: `src/modules/voice/index.ts`
- Test: `tests/voice-drivers.test.ts`

**Interfaces:**
- Produces: `verifyElevenLabsSignature(rawBody: string, header: string | null, secret: string, nowSecs?: number): boolean`; `elevenLabsDriver: VoiceDriver`; `simulationDriver: VoiceDriver` (+ `SIM_TRANSCRIPT: PostCallTurn[]`); `voiceDriverFor(org: { simulated: boolean }): VoiceDriver` in `index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-drivers.test.ts
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", ELEVENLABS_API_KEY: "k", ELEVENLABS_AGENT_ID: "agent_1" },
}));

import { verifyElevenLabsSignature, elevenLabsDriver } from "@/modules/voice/drivers/elevenlabs";
import { simulationDriver } from "@/modules/voice/drivers/simulation";
import { voiceDriverFor } from "@/modules/voice";

const secret = "whsec_test";
const body = '{"type":"post_call_transcription"}';
const sign = (t: number) =>
  `t=${t},v0=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("verifyElevenLabsSignature", () => {
  it("accepts a fresh, correctly signed body", () => {
    expect(verifyElevenLabsSignature(body, sign(1000), secret, 1010)).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets and stale timestamps", () => {
    expect(verifyElevenLabsSignature(body + " ", sign(1000), secret, 1010)).toBe(false);
    expect(verifyElevenLabsSignature(body, sign(1000), "other", 1010)).toBe(false);
    expect(verifyElevenLabsSignature(body, sign(1000), secret, 1000 + 40 * 60)).toBe(false);
    expect(verifyElevenLabsSignature(body, null, secret, 1010)).toBe(false);
  });
});

describe("drivers", () => {
  it("simulation driver returns a fake call id without network", async () => {
    const r = await simulationDriver.outboundCall({
      agentPhoneNumberId: "sim", toE164: "+919876543210",
      init: { dynamic_variables: {}, conversation_config_override: { agent: { prompt: { prompt: "" }, first_message: "", language: "en" } } },
    });
    expect(r.ok).toBe(true);
    expect(r.providerCallId).toMatch(/^sim_/);
  });

  it("elevenlabs driver posts to the sip-trunk outbound endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, conversation_id: "conv_1" }), { status: 200 })
    );
    const r = await elevenLabsDriver.outboundCall({
      agentPhoneNumberId: "pn_1", toE164: "+919876543210",
      init: { dynamic_variables: { org_id: "o" }, conversation_config_override: { agent: { prompt: { prompt: "p" }, first_message: "hi", language: "en" } } },
    });
    expect(r).toEqual({ ok: true, providerCallId: "conv_1" });
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call");
    const sent = JSON.parse(String((opts as RequestInit).body));
    expect(sent.agent_id).toBe("agent_1");
    expect(sent.agent_phone_number_id).toBe("pn_1");
    expect(sent.to_number).toBe("+919876543210");
    expect(sent.conversation_initiation_client_data.dynamic_variables.org_id).toBe("o");
    fetchSpy.mockRestore();
  });

  it("picks the simulation driver for simulated orgs", () => {
    expect(voiceDriverFor({ simulated: true })).toBe(simulationDriver);
    expect(voiceDriverFor({ simulated: false })).toBe(elevenLabsDriver);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-drivers.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/voice/drivers/elevenlabs.ts
import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { VoiceDriver } from "@/modules/voice/types";

const API = "https://api.elevenlabs.io/v1";
const TOLERANCE_SECS = 30 * 60;

/** Header format: `t=<unix>,v0=<hex hmac of "<t>.<body>">`. */
export function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSecs: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const v0 = parts.v0 ?? "";
  if (!Number.isFinite(t) || Math.abs(nowSecs - t) > TOLERANCE_SECS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (expected.length !== v0.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v0, "hex"));
}

export const elevenLabsDriver: VoiceDriver = {
  async outboundCall({ agentPhoneNumberId, toE164, init }) {
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) {
      return { ok: false, error: "ElevenLabs is not configured" };
    }
    const res = await fetch(`${API}/convai/sip-trunk/outbound-call`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        agent_id: env.ELEVENLABS_AGENT_ID,
        agent_phone_number_id: agentPhoneNumberId,
        to_number: toE164,
        conversation_initiation_client_data: init,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean; conversation_id?: string | null; message?: string;
    };
    if (!res.ok || !json.success) return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    return { ok: true, providerCallId: json.conversation_id ?? undefined };
  },
};
```

```ts
// src/modules/voice/drivers/simulation.ts
import type { PostCallTurn, VoiceDriver } from "@/modules/voice/types";

/** A scripted call so test-mode orgs and /demo can "hear" the front desk. */
export const SIM_TRANSCRIPT: PostCallTurn[] = [
  { role: "agent", message: "Hello, you've reached the front desk. How can I help?", t: 0, toolCalls: [] },
  { role: "user", message: "I'd like to book for tomorrow at 5pm, under Priya.", t: 4, toolCalls: [] },
  { role: "agent", message: "Priya, tomorrow at 5pm — I've noted that. The team will confirm on WhatsApp.", t: 9, toolCalls: ["capture_booking_request"] },
  { role: "user", message: "Great, thanks.", t: 14, toolCalls: [] },
  { role: "agent", message: "You're welcome. Goodbye!", t: 16, toolCalls: ["end_call"] },
];

export const simulationDriver: VoiceDriver = {
  async outboundCall() {
    return { ok: true, providerCallId: `sim_${Math.random().toString(36).slice(2, 10)}` };
  },
};
```

```ts
// src/modules/voice/index.ts
import { env } from "@/lib/env";
import { elevenLabsDriver } from "@/modules/voice/drivers/elevenlabs";
import { simulationDriver } from "@/modules/voice/drivers/simulation";
import type { VoiceDriver } from "@/modules/voice/types";

/** Same rule as messaging: global simulation wins; a simulated org stays mocked. */
export function voiceDriverFor(org: { simulated: boolean }): VoiceDriver {
  if (env.SEND_MODE === "simulation" || org.simulated || !env.ELEVENLABS_API_KEY) {
    return simulationDriver;
  }
  return elevenLabsDriver;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-drivers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice/drivers src/modules/voice/index.ts tests/voice-drivers.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): ElevenLabs + simulation drivers, webhook signature check"
```

---

### Task 5: File a finished call into the inbox

**Files:**
- Create: `src/modules/voice/file-call.ts`
- Test: `tests/voice-file-call.test.ts`

**Interfaces:**
- Consumes: `PostCall` (Task 3), `outcomeOf`.
- Produces: `fileCall(orgId: string, call: PostCall, purpose: "inbound" | "reminder" | "no_show"): Promise<{ voiceCallId: string; conversationId: string; contactId: string }>` — idempotent on `providerCallId`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-file-call.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const calls: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  return {
    calls, messages,
    prisma: {
      voiceCall: {
        findUnique: vi.fn(async ({ where }: { where: { providerCallId: string } }) =>
          calls.find((c) => c.providerCallId === where.providerCallId) ?? null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { id: "vc1", ...data }; calls.push(row); return row; }),
      },
      contact: { upsert: vi.fn(async () => ({ id: "c1", name: "+919876543210", optedIn: false, optedOutAt: null })) },
      conversation: { upsert: vi.fn(async () => ({ id: "cv1" })), update: vi.fn(async () => ({})) },
      conversationMessage: { createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => { messages.push(...data); return { count: data.length }; }) },
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn(async () => {}) }));

import { fileCall } from "@/modules/voice/file-call";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";

const call = {
  providerCallId: "conv_1", agentId: "a", direction: "inbound" as const,
  fromE164: "+919876543210", toE164: "+918000000001", durationSecs: 30,
  transcript: [
    { role: "agent" as const, message: "Hello", t: 0, toolCalls: [] },
    { role: "user" as const, message: "Book tomorrow 5", t: 3, toolCalls: [] },
    { role: "agent" as const, message: "Done", t: 8, toolCalls: ["capture_booking_request"] },
  ],
  summary: "Booked.", callSuccessful: true, dynamicVariables: { org_id: "org1" },
};

beforeEach(() => { db.calls.length = 0; db.messages.length = 0; vi.clearAllMocks(); });

describe("fileCall", () => {
  it("creates contact, voice conversation, one message per turn and a VoiceCall", async () => {
    const r = await fileCall("org1", call, "inbound");
    expect(r).toEqual({ voiceCallId: "vc1", conversationId: "cv1", contactId: "c1" });
    expect(db.prisma.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ channel: "voice", orgId: "org1", contactId: "c1" }),
    }));
    expect(db.messages.map((m) => m.direction)).toEqual(["outbound", "inbound", "outbound"]);
    expect(db.calls[0]).toMatchObject({ outcome: "booked", durationSecs: 30, purpose: "inbound", status: "completed" });
    expect(dispatchWebhook).toHaveBeenCalledWith("org1", "call.completed", expect.objectContaining({ outcome: "booked" }));
  });

  it("is idempotent on providerCallId", async () => {
    await fileCall("org1", call, "inbound");
    await fileCall("org1", call, "inbound");
    expect(db.prisma.voiceCall.create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-file-call.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/voice/file-call.ts
import { prisma } from "@/lib/db";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";
import { outcomeOf } from "@/modules/voice/transcript";
import type { PostCall } from "@/modules/voice/types";

const PREVIEW = 80;

export async function fileCall(
  orgId: string,
  call: PostCall,
  purpose: "inbound" | "reminder" | "no_show"
): Promise<{ voiceCallId: string; conversationId: string; contactId: string }> {
  const existing = await prisma.voiceCall.findUnique({ where: { providerCallId: call.providerCallId } });
  const customerE164 = call.direction === "inbound" ? call.fromE164 : call.toE164;

  const contact = await prisma.contact.upsert({
    where: { orgId_phoneE164: { orgId, phoneE164: customerE164 } },
    create: { orgId, phoneE164: customerE164, name: customerE164, optInSource: "voice" },
    update: {},
  });
  const now = new Date();
  const summary = call.summary ?? call.transcript.at(-1)?.message ?? "Phone call";
  const conversation = await prisma.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: {
      orgId, contactId: contact.id, channel: "voice",
      lastInboundAt: now, lastMessageAt: now, lastMessagePreview: summary.slice(0, PREVIEW), unreadCount: 1,
    },
    update: { lastInboundAt: now, lastMessageAt: now, lastMessagePreview: summary.slice(0, PREVIEW), unreadCount: { increment: 1 } },
  });
  if (existing) {
    return { voiceCallId: existing.id as string, conversationId: conversation.id, contactId: contact.id };
  }

  await prisma.conversationMessage.createMany({
    data: call.transcript
      .filter((t) => t.message.trim().length > 0)
      .map((t) => ({
        conversationId: conversation.id,
        direction: t.role === "user" ? "inbound" : "outbound",
        body: t.message,
        metaMessageId: `${call.providerCallId}:${t.t}`,
      })),
  });

  const outcome = outcomeOf(call.transcript);
  const voiceCall = await prisma.voiceCall.create({
    data: {
      orgId, contactId: contact.id, conversationId: conversation.id,
      direction: call.direction, fromE164: call.fromE164, toE164: call.toE164,
      providerCallId: call.providerCallId, status: "completed", durationSecs: call.durationSecs,
      transcript: call.transcript, summary: call.summary, outcome, purpose, endedAt: now,
    },
  });
  if (outcome === "handoff") {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "handoff" } });
  }
  void dispatchWebhook(orgId, "call.completed", {
    voiceCallId: voiceCall.id, conversationId: conversation.id, contactId: contact.id,
    direction: call.direction, durationSecs: call.durationSecs, outcome, summary: call.summary,
  });
  return { voiceCallId: voiceCall.id, conversationId: conversation.id, contactId: contact.id };
}
```
Add `{ value: "call.completed", label: "Call completed" }` to `WEBHOOK_EVENTS` in `src/modules/integrations/outbound-webhooks.ts` (keep the existing entry shape).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-file-call.test.ts tests/webhooks-dispatch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice/file-call.ts src/modules/integrations/outbound-webhooks.ts tests/voice-file-call.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): file finished calls into the inbox + call.completed webhook"
```

---

### Task 6: Initiation webhook route

**Files:**
- Create: `src/app/api/voice/initiation/route.ts`
- Test: `tests/voice-initiation-route.test.ts`

**Interfaces:**
- Consumes: `buildCallInit`, `buildKnowledgeDigest` (`@/modules/knowledge/digest`), `ensureAgentProfile` (`@/modules/agent/profile` — the function `inbound.ts` already calls).
- Produces: `POST /api/voice/initiation` → `CallInit` JSON; 401 on bad secret; 404 unknown number.

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-initiation-route.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { VOICE_INITIATION_SECRET: "s3cret", SEND_MODE: "live" } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    voiceNumber: { findUnique: vi.fn(async ({ where }: { where: { phoneE164: string } }) =>
      where.phoneE164 === "+918000000001"
        ? { id: "vn1", orgId: "org1", phoneE164: "+918000000001", language: "en", voiceId: null, transferTo: "+919800000000", enabled: true,
            org: { id: "org1", timezone: "Asia/Kolkata", simulated: false } }
        : null) },
    contact: { findUnique: vi.fn(async () => ({ name: "Priya", phoneE164: "+919876543210" })) },
    knowledgeEntry: { findMany: vi.fn(async () => [{ category: "hours", fact: "Open 9–7", condition: null }]) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({ enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "" })),
}));

import { POST } from "@/app/api/voice/initiation/route";

const req = (body: unknown, secret = "s3cret") =>
  new Request("http://localhost/api/voice/initiation", {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-nudge-voice-secret": secret },
  });

describe("POST /api/voice/initiation", () => {
  it("returns per-call config for a known number", async () => {
    const res = await POST(req({ caller_id: "+919876543210", called_number: "+918000000001", agent_id: "a", conversation_id: "c" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dynamic_variables.org_id).toBe("org1");
    expect(json.dynamic_variables.contact_name).toBe("Priya");
    expect(json.conversation_config_override.agent.prompt.prompt).toContain("Open 9–7");
  });
  it("rejects a bad secret and an unknown number", async () => {
    expect((await POST(req({ caller_id: "+91", called_number: "+918000000001" }, "nope"))).status).toBe(401);
    expect((await POST(req({ caller_id: "+91", called_number: "+910000000000" }))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-initiation-route.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement**

```ts
// src/app/api/voice/initiation/route.ts
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { ensureAgentProfile } from "@/modules/agent/profile";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { buildCallInit } from "@/modules/voice/initiation";

function secretOk(header: string | null): boolean {
  const expected = env.VOICE_INITIATION_SECRET ?? "";
  if (!expected || !header || header.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** ElevenLabs "conversation initiation client data" webhook — fires when a call rings. */
export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-nudge-voice-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { caller_id?: string; called_number?: string };
  const called = (body.called_number ?? "").startsWith("+") ? body.called_number! : `+${body.called_number ?? ""}`;
  const caller = (body.caller_id ?? "").startsWith("+") ? body.caller_id! : `+${body.caller_id ?? ""}`;

  const number = await prisma.voiceNumber.findUnique({ where: { phoneE164: called }, include: { org: true } });
  if (!number || !number.enabled) return NextResponse.json({ error: "unknown number" }, { status: 404 });

  const profile = await ensureAgentProfile(number.orgId);
  if (!profile || !profile.enabled) return NextResponse.json({ error: "agent disabled" }, { status: 404 });

  const [contact, entries] = await Promise.all([
    prisma.contact.findUnique({ where: { orgId_phoneE164: { orgId: number.orgId, phoneE164: caller } } }),
    prisma.knowledgeEntry.findMany({
      where: { orgId: number.orgId, status: "active" },
      select: { category: true, fact: true, condition: true },
      orderBy: { createdAt: "asc" },
      take: 400,
    }),
  ]);

  const init = buildCallInit({
    org: { id: number.orgId, timezone: number.org.timezone },
    number: { phoneE164: number.phoneE164, language: number.language, voiceId: number.voiceId, transferTo: number.transferTo },
    profile: { vertical: profile.vertical, businessName: profile.businessName, businessInfo: profile.businessInfo, tone: profile.tone, doNots: profile.doNots },
    knowledgeDigest: buildKnowledgeDigest(entries),
    contact: { name: contact?.name ?? caller, phoneE164: caller },
    purpose: "inbound",
    now: new Date(),
  });
  return NextResponse.json(init);
}
```
If `ensureAgentProfile` lives elsewhere, import it from the same path `src/modules/agent/inbound.ts` imports it from — do not duplicate it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-initiation-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/voice/initiation/route.ts tests/voice-initiation-route.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): initiation webhook — per-call prompt, language, voice by dialled number"
```

---

### Task 7: Post-call webhook route

**Files:**
- Create: `src/app/api/voice/post-call/route.ts`
- Test: `tests/voice-post-call-route.test.ts`

**Interfaces:**
- Consumes: `verifyElevenLabsSignature`, `parsePostCall`, `fileCall`.
- Produces: `POST /api/voice/post-call` → `{ ok: true }`; 401 bad signature; 200 + ignored for other event types.

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-post-call-route.test.ts
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { ELEVENLABS_WEBHOOK_SECRET: "whsec", SEND_MODE: "live" } }));
const fileCall = vi.hoisted(() => vi.fn(async () => ({ voiceCallId: "vc", conversationId: "cv", contactId: "c" })));
vi.mock("@/modules/voice/file-call", () => ({ fileCall }));
vi.mock("@/lib/db", () => ({
  prisma: { voiceNumber: { findUnique: vi.fn(async () => ({ orgId: "org1" })) } },
}));

import { POST } from "@/app/api/voice/post-call/route";

const body = JSON.stringify({
  type: "post_call_transcription",
  data: {
    agent_id: "a", conversation_id: "conv_9", transcript: [{ role: "user", message: "hi", time_in_call_secs: 1 }],
    metadata: { call_duration_secs: 12, phone_call: { direction: "inbound", external_number: "+919876543210", agent_number: "+918000000001" } },
    analysis: { transcript_summary: "s", call_successful: "success" },
    dynamic_variables: { org_id: "org1", purpose: "inbound" },
  },
});
const signed = (b: string, secret = "whsec") => {
  const t = Math.floor(Date.now() / 1000);
  const v0 = crypto.createHmac("sha256", secret).update(`${t}.${b}`).digest("hex");
  return new Request("http://localhost/api/voice/post-call", { method: "POST", body: b, headers: { "elevenlabs-signature": `t=${t},v0=${v0}` } });
};

describe("POST /api/voice/post-call", () => {
  it("files a signed transcription for the org that owns the dialled number", async () => {
    const res = await POST(signed(body));
    expect(res.status).toBe(200);
    expect(fileCall).toHaveBeenCalledWith("org1", expect.objectContaining({ providerCallId: "conv_9" }), "inbound");
  });
  it("rejects a bad signature", async () => {
    expect((await POST(signed(body, "wrong"))).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-post-call-route.test.ts`
Expected: FAIL — route missing.

- [ ] **Step 3: Implement**

```ts
// src/app/api/voice/post-call/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { verifyElevenLabsSignature } from "@/modules/voice/drivers/elevenlabs";
import { fileCall } from "@/modules/voice/file-call";
import { parsePostCall } from "@/modules/voice/transcript";

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "voice webhook not configured" }, { status: 503 });
  if (!verifyElevenLabsSignature(raw, request.headers.get("elevenlabs-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const call = parsePostCall(json);
  if (!call) return NextResponse.json({ ok: true, ignored: true });

  // Tenant: the business number on the call, never the body's org_id alone.
  const businessNumber = call.direction === "inbound" ? call.toE164 : call.fromE164;
  const number = await prisma.voiceNumber.findUnique({ where: { phoneE164: businessNumber } });
  const orgId = number?.orgId ?? (call.dynamicVariables.org_id || null);
  if (!orgId) return NextResponse.json({ ok: true, ignored: true });

  const purpose = (["inbound", "reminder", "no_show"] as const).find((p) => p === call.dynamicVariables.purpose) ?? "inbound";
  await fileCall(orgId, call, purpose);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-post-call-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/voice/post-call/route.ts tests/voice-post-call-route.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): post-call webhook (HMAC) files the transcript"
```

---

### Task 8: Webhook tools route — the agent's hands on a call

**Files:**
- Create: `src/modules/voice/tools.ts`
- Create: `src/app/api/voice/tools/[tool]/route.ts`
- Test: `tests/voice-tools-route.test.ts`

**Interfaces:**
- Consumes: `runTool(ctx, { name, input })` from `@/modules/agent/tools`; `ToolContext`.
- Produces: `POST /api/voice/tools/{capture_booking_request|capture_lead|ask_owner|send_payment_link}` with bearer `VOICE_TOOLS_SECRET`; body `{ org_id, contact_phone, conversation_id?, ...toolArgs }`; response `{ result: string }` (ElevenLabs feeds `result` back to the LLM). `handoff_to_human` is NOT exposed here — on calls, hand-off is ElevenLabs' `transfer_to_number` system tool (Task 11 setup script).

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-tools-route.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { VOICE_TOOLS_SECRET: "tool-secret", SEND_MODE: "live" } }));
const runTool = vi.hoisted(() => vi.fn(async (_ctx: unknown, call: { name: string }) => ({ result: `ran ${call.name}` })));
vi.mock("@/modules/agent/tools", () => ({ runTool }));
vi.mock("@/lib/db", () => ({
  prisma: {
    contact: { upsert: vi.fn(async () => ({ id: "c1", name: "+919876543210" })) },
    conversation: { upsert: vi.fn(async () => ({ id: "cv1" })) },
  },
}));

import { POST } from "@/app/api/voice/tools/[tool]/route";

const call = (tool: string, body: unknown, auth = "Bearer tool-secret") =>
  POST(
    new Request(`http://localhost/api/voice/tools/${tool}`, { method: "POST", body: JSON.stringify(body), headers: { authorization: auth, "content-type": "application/json" } }),
    { params: Promise.resolve({ tool }) }
  );

describe("POST /api/voice/tools/[tool]", () => {
  it("runs an allowed tool scoped to the org + caller", async () => {
    const res = await call("capture_booking_request", { org_id: "org1", contact_phone: "+919876543210", name: "Priya", requested_for: "tomorrow 5pm" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "ran capture_booking_request" });
    expect(runTool).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", contactId: "c1", conversationId: "cv1", contactPhone: "+919876543210" }),
      { name: "capture_booking_request", input: { name: "Priya", requested_for: "tomorrow 5pm" } }
    );
  });
  it("rejects bad auth and unknown tools", async () => {
    expect((await call("capture_lead", { org_id: "o", contact_phone: "+91" }, "Bearer nope")).status).toBe(401);
    expect((await call("delete_everything", { org_id: "o", contact_phone: "+91" })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-tools-route.test.ts`
Expected: FAIL — route missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/voice/tools.ts
import { prisma } from "@/lib/db";
import { runTool, type ToolContext } from "@/modules/agent/tools";

export const VOICE_TOOLS = ["capture_booking_request", "capture_lead", "ask_owner", "send_payment_link"] as const;
export type VoiceToolName = (typeof VOICE_TOOLS)[number];

export function isVoiceTool(name: string): name is VoiceToolName {
  return (VOICE_TOOLS as readonly string[]).includes(name);
}

/** Resolve the caller into the same org-scoped ToolContext the chat agent uses. */
export async function voiceToolContext(orgId: string, contactPhone: string): Promise<ToolContext> {
  const contact = await prisma.contact.upsert({
    where: { orgId_phoneE164: { orgId, phoneE164: contactPhone } },
    create: { orgId, phoneE164: contactPhone, name: contactPhone, optInSource: "voice" },
    update: {},
  });
  const conversation = await prisma.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: { orgId, contactId: contact.id, channel: "voice" },
    update: {},
  });
  return { orgId, contactId: contact.id, conversationId: conversation.id, contactName: contact.name, contactPhone };
}

export async function runVoiceTool(name: VoiceToolName, orgId: string, contactPhone: string, input: Record<string, unknown>) {
  const ctx = await voiceToolContext(orgId, contactPhone);
  return runTool(ctx, { name, input });
}
```

```ts
// src/app/api/voice/tools/[tool]/route.ts
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isVoiceTool, runVoiceTool } from "@/modules/voice/tools";

function bearerOk(header: string | null): boolean {
  const expected = `Bearer ${env.VOICE_TOOLS_SECRET ?? ""}`;
  if (!env.VOICE_TOOLS_SECRET || !header || header.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(request: Request, { params }: { params: Promise<{ tool: string }> }) {
  if (!bearerOk(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { tool } = await params;
  if (!isVoiceTool(tool)) return NextResponse.json({ error: "unknown tool" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { org_id, contact_phone, conversation_id: _ignored, ...input } = body;
  if (typeof org_id !== "string" || typeof contact_phone !== "string") {
    return NextResponse.json({ error: "org_id and contact_phone required" }, { status: 400 });
  }
  const phone = contact_phone.startsWith("+") ? contact_phone : `+${contact_phone}`;
  const out = await runVoiceTool(tool, org_id, phone, input);
  return NextResponse.json({ result: out.result });
}
```
Tenant note: `org_id` arrives from ElevenLabs' dynamic variables, which we set in Task 6 from the dialled number, and the route is bearer-gated; a caller cannot forge another org's id without the secret.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-tools-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice/tools.ts "src/app/api/voice/tools/[tool]/route.ts" tests/voice-tools-route.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): webhook tools route — bookings, leads, ask-owner, payment links from a call"
```

---

### Task 9: Reminder + no-show calls on the cron tick

**Files:**
- Create: `src/modules/voice/reminder-calls.ts`
- Modify: `src/app/api/cron/process-queue/route.ts:45` (after `tickBookingReminders`)
- Test: `tests/voice-reminder-calls.test.ts`

**Interfaces:**
- Consumes: `voiceDriverFor`, `buildCallInit`, `buildKnowledgeDigest`, `ensureAgentProfile`.
- Produces: `tickReminderCalls(now?: Date): Promise<{ reminders: number; noShows: number; skipped: number }>`; pure `isCallingHour(now: Date, timezone: string): boolean` (09:00–20:00 local).

- [ ] **Step 1: Write the failing test**

```ts
// tests/voice-reminder-calls.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "simulation" } }));
const state = vi.hoisted(() => ({ created: [] as Record<string, unknown>[], updated: [] as Record<string, unknown>[] }));
vi.mock("@/lib/db", () => ({
  prisma: {
    followUpConfig: { findMany: vi.fn(async () => [{ orgId: "org1", enabled: true, reminderCalls: true }]) },
    voiceNumber: { findFirst: vi.fn(async () => ({ id: "vn1", orgId: "org1", phoneE164: "+918000000001", elevenPhoneId: "pn", language: "en", voiceId: null, transferTo: null, enabled: true })) },
    org: { findUnique: vi.fn(async () => ({ id: "org1", timezone: "Asia/Kolkata", simulated: true })) },
    bookingRequest: {
      findMany: vi.fn(async () => [
        { id: "b1", orgId: "org1", name: "Priya", requestedFor: "today 5pm", scheduledFor: new Date("2026-09-01T11:30:00Z"), status: "confirmed", reminder2SentAt: null,
          contact: { id: "c1", phoneE164: "+919876543210", name: "Priya", optedOutAt: null } },
        { id: "b2", orgId: "org1", name: "Amit", requestedFor: "today 5pm", scheduledFor: new Date("2026-09-01T11:30:00Z"), status: "confirmed", reminder2SentAt: null,
          contact: { id: "c2", phoneE164: "+919876543211", name: "Amit", optedOutAt: new Date() } },
      ]),
      update: vi.fn(async (args: Record<string, unknown>) => { state.updated.push(args); return {}; }),
    },
    voiceCall: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.created.push(data); return { id: "vc" }; }) },
    knowledgeEntry: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({ enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "" })),
}));

import { isCallingHour, tickReminderCalls } from "@/modules/voice/reminder-calls";

describe("isCallingHour", () => {
  it("allows 09:00–20:00 local time only", () => {
    expect(isCallingHour(new Date("2026-09-01T04:30:00Z"), "Asia/Kolkata")).toBe(true);  // 10:00 IST
    expect(isCallingHour(new Date("2026-09-01T16:30:00Z"), "Asia/Kolkata")).toBe(false); // 22:00 IST
  });
});

describe("tickReminderCalls", () => {
  it("calls bookings in the T-2h window, skips opted-out contacts, marks reminder sent", async () => {
    const r = await tickReminderCalls(new Date("2026-09-01T09:45:00Z")); // 15:15 IST, booking at 17:00 IST
    expect(r).toEqual({ reminders: 1, noShows: 0, skipped: 1 });
    expect(state.created[0]).toMatchObject({ orgId: "org1", direction: "outbound", purpose: "reminder", toE164: "+919876543210" });
    expect(state.updated[0]).toMatchObject({ where: { id: "b1" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-reminder-calls.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/modules/voice/reminder-calls.ts
import { prisma } from "@/lib/db";
import { ensureAgentProfile } from "@/modules/agent/profile";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { voiceDriverFor } from "@/modules/voice";
import { buildCallInit } from "@/modules/voice/initiation";

const WINDOW_START_MIN = 90;  // call when the booking is 90–150 minutes away
const WINDOW_END_MIN = 150;

export function isCallingHour(now: Date, timezone: string): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(now));
  return hour >= 9 && hour < 20;
}

export async function tickReminderCalls(now: Date = new Date()) {
  const result = { reminders: 0, noShows: 0, skipped: 0 };
  const configs = await prisma.followUpConfig.findMany({ where: { enabled: true, reminderCalls: true } });
  for (const cfg of configs) {
    const [org, number] = await Promise.all([
      prisma.org.findUnique({ where: { id: cfg.orgId }, select: { id: true, timezone: true, simulated: true } }),
      prisma.voiceNumber.findFirst({ where: { orgId: cfg.orgId, enabled: true } }),
    ]);
    if (!org || !number || !isCallingHour(now, org.timezone)) continue;
    const profile = await ensureAgentProfile(org.id);
    if (!profile?.enabled) continue;
    const entries = await prisma.knowledgeEntry.findMany({
      where: { orgId: org.id, status: "active" }, select: { category: true, fact: true, condition: true }, take: 400,
    });
    const digest = buildKnowledgeDigest(entries);
    const driver = voiceDriverFor(org);

    const from = new Date(now.getTime() + WINDOW_START_MIN * 60_000);
    const to = new Date(now.getTime() + WINDOW_END_MIN * 60_000);
    const due = await prisma.bookingRequest.findMany({
      where: { orgId: org.id, status: "confirmed", reminder2SentAt: null, scheduledFor: { gte: from, lte: to } },
      include: { contact: true },
    });
    for (const booking of due) {
      if (booking.contact.optedOutAt) { result.skipped += 1; continue; }
      const init = buildCallInit({
        org: { id: org.id, timezone: org.timezone },
        number: { phoneE164: number.phoneE164, language: number.language, voiceId: number.voiceId, transferTo: number.transferTo },
        profile: { vertical: profile.vertical, businessName: profile.businessName, businessInfo: profile.businessInfo, tone: profile.tone, doNots: profile.doNots },
        knowledgeDigest: digest,
        contact: { name: booking.contact.name, phoneE164: booking.contact.phoneE164 },
        purpose: "reminder",
        booking: { requestedFor: booking.requestedFor, name: booking.name },
        now,
      });
      const placed = await driver.outboundCall({ agentPhoneNumberId: number.elevenPhoneId ?? "sim", toE164: booking.contact.phoneE164, init });
      await prisma.voiceCall.create({
        data: {
          orgId: org.id, contactId: booking.contact.id, direction: "outbound", purpose: "reminder",
          fromE164: number.phoneE164, toE164: booking.contact.phoneE164,
          providerCallId: placed.providerCallId ?? null, status: placed.ok ? "in_progress" : "failed",
        },
      });
      await prisma.bookingRequest.update({ where: { id: booking.id }, data: { reminder2SentAt: now } });
      if (placed.ok) result.reminders += 1; else result.skipped += 1;
    }
  }
  return result;
}
```
In `src/app/api/cron/process-queue/route.ts`, after `const followUps = await tickBookingReminders();` add:
```ts
  const calls = await tickReminderCalls();
```
import it from `@/modules/voice/reminder-calls`, and include `calls` in the JSON response object.

No-show recovery (`purpose: "no_show"`) is intentionally left for a follow-up task once reminder calls have run on a real client — same loop over `status: "no_show"` bookings from the previous day; the opener already exists in `buildCallInit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/voice-reminder-calls.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice/reminder-calls.ts src/app/api/cron/process-queue/route.ts tests/voice-reminder-calls.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): T-2h reminder calls on the cron tick (opt-out + calling-hours safe)"
```

---

### Task 10: Settings → Voice page + inbox rendering

**Files:**
- Create: `src/app/(app)/settings/voice/page.tsx`, `src/app/(app)/settings/voice/actions.ts`, `src/app/(app)/settings/voice/voice-form.tsx`
- Modify: `src/components/features/app-shell/nav.ts` (settings sub-nav: add `{ label: "Voice", href: "/settings/voice" }` next to WhatsApp — follow the existing entry shape)
- Modify: `src/app/(app)/inbox/[id]/page.tsx` (show a phone chip when `conversation.channel === "voice"`) and the inbox list item component (same chip)
- Test: `tests/voice-settings-actions.test.ts`

**Interfaces:**
- Produces server actions in `actions.ts`: `saveVoiceNumber(form: FormData)` (fields `phoneE164`, `provider` (`exotel|twilio|sim`), `label`, `transferTo`, `language`, `voiceId`, `elevenPhoneId`), `toggleReminderCalls(enabled: boolean)`, `simulateCall()` (test-mode: files `SIM_TRANSCRIPT` via `fileCall` so the owner sees a call in the inbox).

- [ ] **Step 1: Write the failing test (pure validator)**

```ts
// tests/voice-settings-actions.test.ts
import { describe, expect, it } from "vitest";
import { parseVoiceNumberForm } from "@/app/(app)/settings/voice/validate";

describe("parseVoiceNumberForm", () => {
  it("normalises phone numbers and defaults", () => {
    const fd = new FormData();
    fd.set("phoneE164", "91 80000 00001"); fd.set("provider", "exotel"); fd.set("transferTo", "+91 98000 00000");
    expect(parseVoiceNumberForm(fd)).toEqual({
      phoneE164: "+918000000001", provider: "exotel", label: "Main line", transferTo: "+919800000000",
      language: "en", voiceId: null, elevenPhoneId: null,
    });
  });
  it("rejects bad providers and languages", () => {
    const fd = new FormData(); fd.set("phoneE164", "+918000000001"); fd.set("provider", "skype");
    expect(() => parseVoiceNumberForm(fd)).toThrow(/provider/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/voice-settings-actions.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/app/(app)/settings/voice/validate.ts
import { z } from "zod";

const digits = (v: string) => `+${v.replace(/[^\d]/g, "")}`;

const schema = z.object({
  phoneE164: z.string().transform(digits).refine((v) => /^\+\d{8,15}$/.test(v), "phone must be 8–15 digits"),
  provider: z.enum(["exotel", "twilio", "sim"], { message: "provider must be exotel, twilio or sim" }),
  label: z.string().trim().min(1).default("Main line"),
  transferTo: z.string().trim().transform((v) => (v ? digits(v) : null)).nullable().default(null),
  language: z.enum(["en", "hi"]).default("en"),
  voiceId: z.string().trim().transform((v) => v || null).nullable().default(null),
  elevenPhoneId: z.string().trim().transform((v) => v || null).nullable().default(null),
});

export function parseVoiceNumberForm(fd: FormData) {
  const get = (k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)));
  return schema.parse({
    phoneE164: get("phoneE164") ?? "", provider: get("provider"), label: get("label") || undefined,
    transferTo: get("transferTo") ?? "", language: get("language") || undefined,
    voiceId: get("voiceId") ?? "", elevenPhoneId: get("elevenPhoneId") ?? "",
  });
}
```

```ts
// src/app/(app)/settings/voice/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { fileCall } from "@/modules/voice/file-call";
import { SIM_TRANSCRIPT } from "@/modules/voice/drivers/simulation";
import { parseVoiceNumberForm } from "./validate";

export async function saveVoiceNumber(form: FormData) {
  const ctx = await requireOrgContext();
  requireRole(ctx, "ADMIN");
  const org = ctx.org;
  const data = parseVoiceNumberForm(form);
  await prisma.voiceNumber.upsert({
    where: { phoneE164: data.phoneE164 },
    create: { orgId: org.id, ...data },
    update: { ...data, orgId: org.id },
  });
  revalidatePath("/settings/voice");
}

export async function toggleReminderCalls(enabled: boolean) {
  const ctx = await requireOrgContext();
  requireRole(ctx, "ADMIN");
  const org = ctx.org;
  await prisma.followUpConfig.upsert({
    where: { orgId: org.id },
    create: { orgId: org.id, enabled: true, reminderCalls: enabled },
    update: { reminderCalls: enabled },
  });
  revalidatePath("/settings/voice");
}

/** Test mode: drop a scripted call into the inbox so the owner sees what a call looks like. */
export async function simulateCall() {
  const { org } = await requireOrgContext();
  const number = await prisma.voiceNumber.findFirst({ where: { orgId: org.id } });
  await fileCall(org.id, {
    providerCallId: `sim_${Date.now()}`, agentId: "sim", direction: "inbound",
    fromE164: "+919810009999", toE164: number?.phoneE164 ?? "+910000000000", durationSecs: 18,
    transcript: SIM_TRANSCRIPT, summary: "Priya booked tomorrow at 5pm.", callSuccessful: true,
    dynamicVariables: { org_id: org.id, purpose: "inbound" },
  }, "inbound");
  revalidatePath("/inbox");
}
```
`requireRole(ctx, "ADMIN")` takes the whole `OrgContext` (see `settings/whatsapp/actions.ts`).

`page.tsx`: server component; loads `voiceNumber.findMany({ where: { orgId } })`, `followUpConfig`, `isSimulated(org)`; renders `SettingsSection` (the same wrapper WhatsApp settings use) with: the numbers list, `VoiceForm` (fields above, provider select, language select en/hi, voice id, transfer number), a "Call reminders 2h before" toggle calling `toggleReminderCalls`, a **Test mode** banner with a "Simulate a call" button (`simulateCall`), and the carrier instructions block (Exotel: point the vSIP trunk at `sip.rtc.elevenlabs.io:5060` TLS; Twilio: assign the number to the Nudge agent in ElevenLabs).

Inbox: where the WhatsApp icon/label renders for a thread, add `{conversation.channel === "voice" && <Badge tone="info">Phone call</Badge>}`; transcript turns already render as messages.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/voice-settings-actions.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings/voice" src/components/features/app-shell/nav.ts "src/app/(app)/inbox"
git add tests/voice-settings-actions.test.ts
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): Settings → Voice (numbers, language, transfer, reminder calls, simulate) + inbox call chip"
```

---

### Task 11: Setup script, docs, gates

**Files:**
- Create: `scripts/voice-setup.ts`
- Create: `docs/VOICE.md`
- Modify: `PROGRESS.md` (new entry at top), `docs/PRICING.md` §2 (voice add-on line once the founder confirms the price)

**Interfaces:**
- Produces: one-shot script that creates the shared ElevenLabs agent with the pinned LLM, system tools (`end_call`, `transfer_to_number` → dynamic variable `transfer_to`), four webhook tools pointing at `{APP_URL}/api/voice/tools/{name}` with header `Authorization: Bearer {VOICE_TOOLS_SECRET}`, and prints `ELEVENLABS_AGENT_ID`.

- [ ] **Step 1: Write the script**

```ts
// scripts/voice-setup.ts — run: npx esbuild scripts/voice-setup.ts --bundle --platform=node --format=cjs --outfile=.next/voice-setup.cjs && PROJECT_ROOT=$PWD node .next/voice-setup.cjs
import fs from "node:fs";
import path from "node:path";
import { assertRuntimeModelAllowed } from "../src/lib/model-router/guard";

const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const key = process.env.ELEVENLABS_API_KEY!;
const app = process.env.NEXT_PUBLIC_APP_URL ?? "https://nudgeagent.app";
const llm = process.env.ELEVENLABS_LLM ?? "claude-haiku-4-5";
assertRuntimeModelAllowed(llm);

const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "webhook",
  name,
  description,
  api_schema: {
    url: `${app}/api/voice/tools/${name}`,
    method: "POST",
    request_headers: { Authorization: `Bearer ${process.env.VOICE_TOOLS_SECRET}` },
    request_body_schema: {
      type: "object",
      required: ["org_id", "contact_phone", ...required],
      properties: {
        org_id: { type: "string", dynamic_variable: "org_id" },
        contact_phone: { type: "string", dynamic_variable: "contact_phone" },
        ...properties,
      },
    },
  },
});

async function main() {
  const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Nudge Front Desk (shared)",
      conversation_config: {
        agent: {
          first_message: "Hello, how can I help you today?",
          language: "en",
          prompt: {
            prompt: "You are the front desk of a small business. The per-call instructions arrive at call start.",
            llm,
            temperature: 0.3,
            tools: [
              { type: "system", name: "end_call", description: "End the call when the caller is done." },
              { type: "system", name: "transfer_to_number", description: "Transfer to a human.", params: { transfers: [{ phone_number: "{{transfer_to}}", condition: "The caller asks for a person or you cannot help." }] } },
              tool("capture_booking_request", "Save an appointment/table request once name and time are confirmed.",
                { name: { type: "string", description: "Caller's name" }, requested_for: { type: "string", description: "Day and time in the caller's words" }, party_size: { type: "integer", description: "Number of people, if relevant" }, notes: { type: "string", description: "Anything else" } },
                ["name", "requested_for"]),
              tool("capture_lead", "Record buying interest.", { name: { type: "string" }, interest: { type: "string", description: "What they want" }, details: { type: "string" } }, ["interest"]),
              tool("ask_owner", "Ask the owner a question you cannot answer from the business information.", { question: { type: "string" } }, ["question"]),
              tool("send_payment_link", "Send a payment link on WhatsApp for a deposit.", { amount: { type: "number" }, purpose: { type: "string" } }, ["amount", "purpose"]),
            ],
          },
        },
        tts: { model_id: "eleven_flash_v2_5" },
      },
      platform_settings: {
        workspace_overrides: {
          conversation_initiation_client_data_webhook: {
            url: `${app}/api/voice/initiation`,
            request_headers: { "x-nudge-voice-secret": process.env.VOICE_INITIATION_SECRET },
          },
        },
      },
    }),
  });
  const json = (await res.json()) as { agent_id?: string; detail?: unknown };
  if (!res.ok || !json.agent_id) throw new Error(`create agent failed: ${JSON.stringify(json.detail ?? json)}`);
  console.log(`ELEVENLABS_AGENT_ID=${json.agent_id}`);
  console.log("Next: Agents → Settings → Post-call webhooks → add", `${app}/api/voice/post-call`, "and copy its secret into ELEVENLABS_WEBHOOK_SECRET.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
```
If ElevenLabs rejects a field name (their schema moves), fix the field in the script rather than in the dashboard, so setup stays reproducible; the `tools` array is documented as deprecated in favour of `tool_ids` — if `tools` is refused, create each tool via `POST /v1/convai/tools` first and pass the ids as `tool_ids`.

- [ ] **Step 2: Write `docs/VOICE.md`**

Contents: what the feature does; the call flow (spec §A3 condensed); carrier setup for Exotel (KYC, vSIP to `sip.rtc.elevenlabs.io:5060` TLS, import number in ElevenLabs → note `agent_phone_number_id` into Settings → Voice `elevenPhoneId`) and Twilio; env vars; how to run `scripts/voice-setup.ts`; test-mode behaviour; compliance notes (opt-out respected, 09:00–20:00 local, no promotional calls); pricing add-on.

- [ ] **Step 3: Full gates + smoke**

Run:
```bash
npx vitest run && npm run lint && npx tsc --noEmit && npm run build
npx next start -p 3100 &   # then, in test mode:
curl -s -X POST localhost:3100/api/voice/post-call -d '{}'   # → 503 (not configured) or 401 — never 500
```
Expected: all green; the manual "Simulate a call" button files a call visible in Inbox with the phone chip.

- [ ] **Step 4: PROGRESS.md entry + commit + push**

```bash
git add scripts/voice-setup.ts docs/VOICE.md PROGRESS.md docs/PRICING.md
git -c user.name=CUSTEDLOL -c user.email=visheshmunoth.vj@gmail.com commit -m "feat(voice): ElevenLabs agent setup script, VOICE.md, pricing add-on"
git pull --rebase origin main && git push origin main
```

---

## Self-review notes
- Spec §A3 inbound flow → Tasks 6, 8, 7, 5. Outbound → Tasks 4, 9. Hand-off → `transfer_to_number` in Task 11 + `outcomeOf` in Task 3. Simulation → Task 4 driver + Task 10 `simulateCall`. Settings/inbox → Task 10. Env/guard → Task 1. Pricing/doc → Task 11.
- Not built here by design: no-show recovery calls (loop noted in Task 9), audio recording storage, the v2 custom-LLM endpoint, WhatsApp Calling API.
- Names used consistently: `buildCallInit`, `parsePostCall`, `outcomeOf`, `fileCall`, `voiceDriverFor`, `verifyElevenLabsSignature`, `runVoiceTool`, `tickReminderCalls`, `parseVoiceNumberForm`.
