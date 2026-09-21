import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Connecting a number no longer flips the workspace live — that is a founder
 * control. Which creates a new state the owner can sit in: number connected,
 * still in test, nothing reaching customers. It must never look normal.
 *
 * It also has to answer the question owners actually ask ("how do I stop the
 * AI for a bit?"), because the live/test switch is not theirs and pausing the
 * agent is the safer control anyway — messages still land in the inbox.
 */
const page = readFileSync("src/app/(app)/settings/whatsapp/page.tsx", "utf8");
const stats = readFileSync("src/modules/dashboard/stats.ts", "utf8");

describe("connected but not live", () => {
  it("says so on the WhatsApp settings page rather than looking connected", () => {
    expect(page).toMatch(/account && simulation|simulation && account/);
    expect(page).toMatch(/not live yet|isn.t live yet/i);
  });

  it("tells the owner who flips the switch, so they are not hunting for it", () => {
    expect(page).toMatch(/switch you live/i);
  });

  it("points at pausing the AI as the control they DO have", () => {
    expect(page).toMatch(/AI Agent/);
    expect(page).toMatch(/inbox/i);
  });
});

describe("the go-live checklist stays honest", () => {
  it("distinguishes linked-and-live from linked-but-waiting", () => {
    const item = stats.slice(stats.indexOf('key: "whatsapp"'), stats.indexOf('href: "/settings/whatsapp"'));
    expect(item).toMatch(/simulationMode/);
    expect(item).toMatch(/switch you live|not live yet/i);
  });
});
