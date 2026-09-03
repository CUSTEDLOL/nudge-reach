import { buildAgentSystemPrompt } from "@/modules/agent/prompt";
import type { CallInit, CallInitInput } from "@/modules/voice/types";

/**
 * Per-call context for the voice agent. Same system prompt as the WhatsApp
 * agent (identity, scope, knowledge digest, tools) plus phone manners; the
 * opener depends on why we are on the call.
 */

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
