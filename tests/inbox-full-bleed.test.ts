import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/shell-actions", () => ({
  saveSidebarCollapsedAction: vi.fn(),
}));

import { isInboxAppRoute } from "@/components/features/app-shell/shell";

describe("isInboxAppRoute", () => {
  it("fills the viewport for the inbox list and a thread", () => {
    expect(isInboxAppRoute("/inbox")).toBe(true);
    expect(isInboxAppRoute("/inbox/abc123")).toBe(true);
  });

  it("leaves the Try-your-AI page and other routes as normal pages", () => {
    expect(isInboxAppRoute("/inbox/try")).toBe(false);
    expect(isInboxAppRoute("/inbox/try/")).toBe(false);
    expect(isInboxAppRoute("/dashboard")).toBe(false);
    expect(isInboxAppRoute("/inboxes")).toBe(false);
  });
});
