/**
 * Voice front desk — shared types. The conversation loop runs at ElevenLabs;
 * we supply per-call context (CallInit), execute tools, and file the transcript
 * (PostCall). Everything here is provider-agnostic except the field names
 * ElevenLabs expects in CallInit.
 */

export interface CallInitInput {
  org: { id: string; timezone: string };
  number: {
    phoneE164: string;
    language: string;
    voiceId: string | null;
    transferTo: string | null;
  };
  profile: {
    vertical: string;
    businessName: string;
    businessInfo: string;
    tone: string;
    doNots: string;
  };
  knowledgeDigest: string;
  contact: { name: string; phoneE164: string };
  purpose: "inbound" | "reminder" | "no_show";
  booking?: { requestedFor: string; name: string };
  now: Date;
}

/** ElevenLabs "conversation initiation client data" — exact field names. */
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
  /** Seconds into the call. */
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
