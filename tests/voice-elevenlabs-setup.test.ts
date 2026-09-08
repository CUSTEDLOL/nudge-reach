import { describe, expect, it } from "vitest";
import {
  buildElevenLabsAgentPayload,
  buildVoiceWebhookTool,
  buildWorkspaceSettingsPayload,
  VOICE_WEBHOOK_TOOL_SPECS,
} from "@/modules/voice/elevenlabs-setup";

describe("ElevenLabs setup payload", () => {
  it("uses standalone tool ids, current system-tool params and enables every runtime override", () => {
    const payload = buildElevenLabsAgentPayload({
      appUrl: "https://nudge.example/",
      initiationSecret: "init-secret",
      llm: "claude-haiku-4-5",
      toolIds: ["tool_1", "tool_2"],
    });
    const prompt = payload.conversation_config.agent.prompt;
    expect(prompt.tool_ids).toEqual(["tool_1", "tool_2"]);
    expect(prompt).not.toHaveProperty("tools");
    expect(prompt.built_in_tools.end_call.params.system_tool_type).toBe("end_call");
    expect(prompt.built_in_tools.end_call.type).toBe("system");
    expect(
      prompt.built_in_tools.transfer_to_number.params.transfers[0].transfer_destination
    ).toEqual({ type: "phone_dynamic_variable", phone_number: "transfer_to" });
    expect(payload.platform_settings.overrides).toMatchObject({
      enable_conversation_initiation_client_data_from_webhook: true,
      conversation_config_override: {
        agent: { first_message: true, language: true, prompt: { prompt: true } },
        tts: { voice_id: true },
      },
    });
  });

  it("binds every webhook tool to signed per-call dynamic context", () => {
    expect(VOICE_WEBHOOK_TOOL_SPECS.map((tool) => tool.name)).toEqual([
      "capture_booking_request",
      "capture_lead",
      "ask_owner",
    ]);
    const tool = buildVoiceWebhookTool(
      VOICE_WEBHOOK_TOOL_SPECS[0],
      "https://nudge.example/",
      "bearer-secret"
    );
    expect(tool.api_schema.url).toBe("https://nudge.example/api/voice/tools/capture_booking_request");
    expect(tool.api_schema.request_body_schema.required).toEqual(
      expect.arrayContaining(["org_id", "contact_phone", "call_source", "tool_token"])
    );
    expect(tool.api_schema.request_body_schema.properties.tool_token).toEqual({
      type: "string",
      dynamic_variable: "tool_token",
    });
  });

  it("points the workspace at the post-call and initiation webhooks", () => {
    const settings = buildWorkspaceSettingsPayload({
      appUrl: "https://nudge.example/",
      initiationSecret: "init-secret",
      postCallWebhookId: "wh_1",
    });
    expect(settings.webhooks).toEqual({ post_call_webhook_id: "wh_1", send_audio: false });
    expect(settings.conversation_initiation_client_data_webhook).toEqual({
      url: "https://nudge.example/api/voice/initiation",
      request_headers: { "x-nudge-voice-secret": "init-secret" },
    });
  });
});
