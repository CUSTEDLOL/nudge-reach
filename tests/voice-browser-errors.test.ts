import { describe, expect, it } from "vitest";
import {
  browserCallErrorMessage,
  microphoneStateAfterError,
  microphoneStateFromPermission,
  requestMicrophoneAccess,
} from "@/modules/voice/browser-call-errors";

describe("microphone permission flow", () => {
  it("keeps the permission prompt and granted states distinct", () => {
    expect(microphoneStateFromPermission("prompt", true)).toBe("prompt");
    expect(microphoneStateFromPermission("granted", true)).toBe("granted");
    expect(microphoneStateFromPermission("denied", true)).toBe("denied");
    expect(microphoneStateFromPermission(null, false)).toBe("unsupported");
  });

  it("requests microphone capture and releases every temporary track", async () => {
    let captures = 0;
    let stoppedTracks = 0;
    const result = await requestMicrophoneAccess({
      isSecureContext: true,
      getUserMedia: async () => {
        captures += 1;
        return {
          getTracks: () => [
            { stop: () => { stoppedTracks += 1; } },
            { stop: () => { stoppedTracks += 1; } },
          ],
        };
      },
    });

    expect(result).toBe("granted");
    expect(captures).toBe(1);
    expect(stoppedTracks).toBe(2);
  });

  it("does not attempt capture on an insecure or unsupported page", async () => {
    let captures = 0;
    await expect(requestMicrophoneAccess({
      isSecureContext: false,
      getUserMedia: async () => {
        captures += 1;
        return { getTracks: () => [] };
      },
    })).rejects.toMatchObject({ name: "SecurityError" });
    expect(captures).toBe(0);
  });

  it("moves blocked permission into a recoverable denied state", () => {
    expect(microphoneStateAfterError(new DOMException("", "NotAllowedError"))).toBe("denied");
    expect(microphoneStateAfterError(new DOMException("", "NotFoundError"))).toBe("prompt");
  });
});

describe("browser call startup errors", () => {
  it("explains when the operating system exposes no microphone", () => {
    expect(browserCallErrorMessage("microphone", new DOMException("", "NotFoundError"))).toBe(
      "No microphone was detected. Connect or enable an input device, then try again."
    );
  });

  it("does not confuse denied permission with a missing device", () => {
    expect(browserCallErrorMessage("microphone", new DOMException("", "NotAllowedError"))).toBe(
      "Microphone access is blocked. Allow it in your browser and system settings, then reload this page."
    );
  });

  it("explains when another app or the audio system has made the device unreadable", () => {
    expect(browserCallErrorMessage("microphone", { name: "NotReadableError" })).toBe(
      "Your microphone is unavailable or being used by another app. Close other audio apps and try again."
    );
  });

  it("never labels a backend or provider failure as a microphone problem", () => {
    expect(browserCallErrorMessage("call", new Error("database unavailable"))).toBe(
      "The browser call couldn't start. Check your connection and try again."
    );
  });
});
