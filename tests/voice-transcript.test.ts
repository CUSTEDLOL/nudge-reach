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
      {
        role: "agent",
        message: "Done, see you tomorrow.",
        time_in_call_secs: 9,
        tool_calls: [{ tool_name: "capture_booking_request", params_as_json: "{}" }],
      },
    ],
    metadata: {
      start_time_unix_secs: 1787989900,
      call_duration_secs: 42,
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

  // The shape ElevenLabs really sends for a browser (js_sdk / react_sdk)
  // session, captured from production on 2026-09-15: phone_call is null, and
  // the per-call variables sit under conversation_initiation_client_data.
  // Before this case existed every browser call was silently "ignored".
  it("parses a real browser-session payload: null phone block, nested dynamic variables", () => {
    const call = parsePostCall({
      type: "post_call_transcription",
      event_timestamp: 1789468000,
      data: {
        agent_id: "agent_1",
        conversation_id: "conv_react",
        status: "done",
        transcript: [{ role: "agent", message: "Hello, you've reached Spice Garden.", time_in_call_secs: 0, tool_calls: null }],
        metadata: { call_duration_secs: 18, phone_call: null, batch_call: null, error: null },
        analysis: { transcript_summary: null, call_successful: null, evaluation_criteria_results: {} },
        conversation_initiation_client_data: {
          conversation_config_override: { agent: { prompt: null, first_message: "Hello", language: "en" } },
          dynamic_variables: {
            org_id: "org1",
            contact_phone: "+999000000000",
            contact_name: "Browser test caller",
            call_source: "browser",
            tool_token: "v1.1.sig",
            purpose: "inbound",
            system__agent_id: "agent_1",
            system__conversation_id: "conv_react",
          },
        },
      },
    })!;
    expect(call).not.toBeNull();
    expect(call.direction).toBe("inbound");
    expect(call.fromE164).toBe("+999000000000");
    expect(call.toE164).toBe("");
    expect(call.summary).toBeNull();
    expect(call.callSuccessful).toBe(false);
    expect(call.dynamicVariables).toEqual({
      org_id: "org1",
      contact_phone: "+999000000000",
      contact_name: "Browser test caller",
      call_source: "browser",
      tool_token: "v1.1.sig",
      purpose: "inbound",
    });
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
