import { z } from "zod";
import type { PostCall, PostCallTurn } from "@/modules/voice/types";

/**
 * Normalises ElevenLabs' post-call transcription webhook into our PostCall
 * shape. Pure, tolerant of missing optional blocks, unit-tested.
 */

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
    dynamic_variables: z.record(z.string(), z.unknown()).default({}),
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
  // Inbound: the customer is the external number. Outbound: we dialled them.
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

/** What the call achieved, from the tools the agent used. */
export function outcomeOf(turns: PostCallTurn[]): "booked" | "lead" | "handoff" | "info" {
  const tools = new Set(turns.flatMap((t) => t.toolCalls));
  if (tools.has("capture_booking_request")) return "booked";
  if (tools.has("transfer_to_number") || tools.has("handoff_to_human")) return "handoff";
  if (tools.has("capture_lead")) return "lead";
  return "info";
}
