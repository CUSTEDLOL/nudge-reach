import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrialReadOnlyThread } from "@/components/features/trial/trial-read-only-thread";

describe("trial read-only shared inbox", () => {
  it("renders the sandbox thread without a composer or paid mutations", () => {
    const html = renderToStaticMarkup(
      createElement(TrialReadOnlyThread, {
        identityLabel: "Test customer · private simulation",
        messages: [
          {
            id: "message_1",
            direction: "inbound",
            body: "Are you open?",
            createdAt: "2026-09-21T08:00:00.000Z",
            metaMessageId: null,
          },
          {
            id: "message_2",
            direction: "outbound",
            body: "Yes, until 6pm.",
            createdAt: "2026-09-21T08:00:01.000Z",
            metaMessageId: null,
          },
        ],
      }),
    );

    expect(html).toContain("Shared inbox preview");
    expect(html).toContain("Read only");
    expect(html).toContain("Are you open?");
    expect(html).toContain("Yes, until 6pm.");
    expect(html).toContain('href="/inbox/try"');
    expect(html).not.toContain("textarea");
    expect(html).not.toContain("Send message");
    expect(html).not.toContain("Assign");
  });
});
