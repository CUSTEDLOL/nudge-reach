export type BrowserCallErrorStage = "microphone" | "call";
export type MicrophoneUiState = "checking" | "prompt" | "granted" | "denied" | "unsupported";

interface TemporaryMicrophoneStream {
  getTracks(): Array<{ stop(): void }>;
}

interface MicrophoneEnvironment {
  isSecureContext: boolean;
  getUserMedia?: () => Promise<TemporaryMicrophoneStream>;
}

function errorName(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return "";
  return typeof error.name === "string" ? error.name : "";
}

export function microphoneStateFromPermission(
  permission: PermissionState | null,
  supported: boolean
): MicrophoneUiState {
  if (!supported) return "unsupported";
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  return "prompt";
}

export function microphoneStateAfterError(error: unknown): MicrophoneUiState {
  if (["NotAllowedError", "PermissionDeniedError"].includes(errorName(error))) return "denied";
  if (errorName(error) === "SecurityError") return "unsupported";
  return "prompt";
}

/**
 * Calling this from a click handler is what allows the browser to show its
 * native microphone prompt. The temporary stream is never kept or recorded.
 */
export async function requestMicrophoneAccess({
  isSecureContext,
  getUserMedia,
}: MicrophoneEnvironment): Promise<"granted"> {
  if (!isSecureContext || !getUserMedia) {
    throw new DOMException("Microphone capture is unavailable", "SecurityError");
  }
  const stream = await getUserMedia();
  stream.getTracks().forEach((track) => track.stop());
  return "granted";
}

/** Stable, non-sensitive recovery guidance for browser-call startup failures. */
export function browserCallErrorMessage(stage: BrowserCallErrorStage, error: unknown) {
  if (stage === "call") {
    return "The browser call couldn't start. Check your connection and try again.";
  }

  switch (errorName(error)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone access is blocked. Allow it in your browser and system settings, then reload this page.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was detected. Connect or enable an input device, then try again.";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "Your microphone is unavailable or being used by another app. Close other audio apps and try again.";
    case "SecurityError":
      return "This browser cannot use the microphone on this page. Check site permissions and try again.";
    default:
      return "We couldn't access your microphone. Check your audio input and try again.";
  }
}
