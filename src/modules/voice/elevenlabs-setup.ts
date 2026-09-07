/** Pure builders for the current ElevenLabs Agents API. */

export interface VoiceWebhookToolSpec {
  name: "capture_booking_request" | "capture_lead" | "ask_owner";
  description: string;
  properties: Record<string, unknown>;
  required: string[];
}

export const VOICE_WEBHOOK_TOOL_SPECS: VoiceWebhookToolSpec[] = [
  {
    name: "capture_booking_request",
    description: "Save a booking request after the caller confirms their name and requested time.",
    properties: {
      name: { type: "string", description: "Caller's confirmed name" },
      requested_for: { type: "string", description: "Confirmed day and time in the caller's words" },
      party_size: { type: "integer", description: "Number of people, when relevant" },
      notes: { type: "string", description: "Any other confirmed request details" },
    },
    required: ["name", "requested_for"],
  },
  {
    name: "capture_lead",
    description: "Mandatory first action on clear buying intent: record it immediately, before asking for a name, date, time, or other details.",
    properties: {
      name: { type: "string", description: "Caller's name, when known" },
      interest: { type: "string", description: "What the caller wants" },
      details: { type: "string", description: "Other useful details the caller provided" },
    },
    required: ["interest"],
  },
  {
    name: "ask_owner",
    description: "Record one business-specific question or callback request for the team.",
    properties: { question: { type: "string", description: "The exact question or callback request" } },
    required: ["question"],
  },
];

export function buildVoiceWebhookTool(
  spec: VoiceWebhookToolSpec,
  appUrl: string,
  bearerSecret: string
) {
  return {
    type: "webhook",
    name: spec.name,
    description: spec.description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${appUrl.replace(/\/$/, "")}/api/voice/tools/${spec.name}`,
      method: "POST",
      request_headers: { Authorization: `Bearer ${bearerSecret}` },
      request_body_schema: {
        type: "object",
        required: [
          "org_id",
          "contact_phone",
          "call_source",
          "tool_token",
          ...spec.required,
        ],
        properties: {
          org_id: { type: "string", dynamic_variable: "org_id" },
          contact_phone: { type: "string", dynamic_variable: "contact_phone" },
          call_source: { type: "string", dynamic_variable: "call_source" },
          tool_token: { type: "string", dynamic_variable: "tool_token" },
          ...spec.properties,
        },
      },
    },
  };
}

export function buildElevenLabsAgentPayload(input: {
  appUrl: string;
  initiationSecret: string;
  llm: string;
  toolIds: string[];
}) {
  const appUrl = input.appUrl.replace(/\/$/, "");
  return {
    name: "Nudge Front Desk (shared)",
    conversation_config: {
      agent: {
        first_message:
          "Hello, this is an AI assistant. This call may be recorded and shared with the business team. I can't load the business details right now, so please call again shortly.",
        language: "en",
        prompt: {
          prompt:
            "You are Nudge's front desk. Business-specific instructions must arrive at call start. If they are missing, apologise, ask the caller to try again, then call end_call. Never answer from general knowledge.",
          llm: input.llm,
          temperature: 0.3,
          max_tokens: 350,
          tool_ids: input.toolIds,
          built_in_tools: {
            end_call: {
              type: "system",
              name: "end_call",
              description: "End the call after a goodbye or when safe business context is unavailable.",
              params: { system_tool_type: "end_call" },
            },
            transfer_to_number: {
              type: "system",
              name: "transfer_to_number",
              description: "Transfer to the business's configured human number when instructed.",
              params: {
                system_tool_type: "transfer_to_number",
                transfers: [
                  {
                    transfer_destination: {
                      type: "phone_dynamic_variable",
                      phone_number: "transfer_to",
                    },
                    condition:
                      "The per-call instructions allow transfer and the caller asks for a human or needs immediate escalation.",
                  },
                ],
              },
            },
          },
        },
      },
      // ElevenLabs requires turbo/flash v2 for an English agent (v2_5 is the
      // multilingual family and is rejected with "English Agents must use
      // turbo or flash v2"). Hindi/Hinglish numbers arrive later via a
      // language preset, not by changing this base model.
      tts: { model_id: "eleven_flash_v2" },
      conversation: { max_duration_seconds: 480 },
      turn: { turn_timeout: 10 },
    },
    platform_settings: {
      overrides: {
        enable_conversation_initiation_client_data_from_webhook: true,
        conversation_config_override: {
          agent: {
            first_message: true,
            language: true,
            prompt: { prompt: true },
          },
          tts: { voice_id: true },
        },
      },
      workspace_overrides: {
        conversation_initiation_client_data_webhook: {
          url: `${appUrl}/api/voice/initiation`,
          request_headers: { "x-nudge-voice-secret": input.initiationSecret },
        },
      },
    },
  };
}

/** Workspace-level wiring: post-call transcript webhook + initiation webhook. */
export function buildWorkspaceSettingsPayload(input: {
  appUrl: string;
  initiationSecret: string;
  postCallWebhookId: string;
}) {
  const base = input.appUrl.replace(/\/$/, "");
  return {
    webhooks: { post_call_webhook_id: input.postCallWebhookId, send_audio: false },
    conversation_initiation_client_data_webhook: {
      url: `${base}/api/voice/initiation`,
      request_headers: { "x-nudge-voice-secret": input.initiationSecret },
    },
  };
}
