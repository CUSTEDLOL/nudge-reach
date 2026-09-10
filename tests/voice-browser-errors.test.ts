import { describe, expect, it } from "vitest";
import { browserCallErrorMessage } from "@/modules/voice/browser-call-errors";

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
