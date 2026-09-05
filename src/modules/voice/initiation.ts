import { buildAgentSystemPrompt } from "@/modules/agent/prompt";
import type { CallInit, CallInitInput } from "@/modules/voice/types";

/**
 * Per-call context for the voice agent. Same system prompt as the WhatsApp
 * agent (identity, scope, knowledge digest, tools) plus phone manners; the
 * opener depends on why we are on the call.
 */

function opener(input: CallInitInput): string {
  const biz = input.profile.businessName;
  if (input.purpose === "reminder" && input.booking) {
    return `Hi ${input.booking.name}, this is ${biz}'s AI assistant. This call may be recorded and shared with the business team. I'm calling to confirm your appointment ${input.booking.requestedFor}. Does that still work for you?`;
  }
  if (input.purpose === "no_show" && input.booking) {
    return `Hi ${input.booking.name}, this is ${biz}'s AI assistant. This call may be recorded and shared with the business team. We missed you ${input.booking.requestedFor}. Would you like to pick a new time?`;
  }
  return `Hello, you've reached ${biz}'s AI assistant. This call may be recorded and shared with the business team. How can I help you today?`;
}

export function buildCallInit(input: CallInitInput): CallInit {
  const prompt = buildAgentSystemPrompt(input.profile, {
    knowledgeDigest: input.knowledgeDigest,
    now: input.now,
    timezone: input.org.timezone,
    withTools: true,
    channel: "voice",
    canTransfer: input.source === "phone" && Boolean(input.number.transferTo),
  });

  const init: CallInit = {
    dynamic_variables: {
      org_id: input.org.id,
      contact_phone: input.contact.phoneE164,
      contact_name: input.contact.name,
      business_name: input.profile.businessName,
      transfer_to: input.number.transferTo ?? "",
      purpose: input.purpose,
      call_source: input.source,
      tool_token: input.toolToken,
    },
    conversation_config_override: {
      agent: {
        prompt: { prompt },
        first_message: opener(input),
        language: input.number.language,
      },
    },
  };
  if (input.number.voiceId) {
    init.conversation_config_override.tts = { voice_id: input.number.voiceId };
  }
  return init;
}
