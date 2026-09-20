import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The founder controls page. The Live/test card disables "Switch to live"
 * until a WhatsApp number is connected — correct, but a disabled button
 * explains nothing, and a native `title` never fires on one because a
 * disabled control swallows pointer events. The reason has to be reachable
 * two ways: on hover, and as text for anyone who never hovers.
 */
const source = readFileSync("src/app/admin/orgs/[id]/controls/page.tsx", "utf8");

/** The Live/test card only. */
const card = source.slice(
  source.indexOf("<CardTitle>Live / test mode</CardTitle>"),
  source.indexOf("<CardTitle>Call minutes</CardTitle>")
);

describe("Live / test mode card", () => {
  it("still refuses to go live without a connected number", () => {
    expect(source).toContain(
      "const blockedFromLive = org.simulated && org._count.whatsappAccounts === 0"
    );
    expect(card).toContain("disabled={blockedFromLive}");
  });

  it("says in plain text why it is blocked, and where to fix it", () => {
    expect(card).toMatch(/Connect[\s\S]*?number/i);
    expect(card).toContain("Integrations");
  });

  it("shows the reason on hover, via a wrapper (a disabled button fires no hover events)", () => {
    expect(card).toContain("group relative");
    expect(card).toContain("group-hover:opacity-100");
    // The bubble must not eat the hover it is explaining.
    expect(card).toContain("pointer-events-none");
  });

  it("only explains the block when the block applies", () => {
    // The tooltip is conditional — a connected workspace gets no nag.
    expect(card).toMatch(/blockedFromLive\s*&&/);
  });

  it("keeps going live behind a reason and a typed confirmation", () => {
    expect(card).toContain("askReason");
    expect(card).toContain("confirmText");
    expect(card).toContain("danger: org.simulated");
  });

  it("lets a live workspace go back to test mode with no number gate", () => {
    // Only `live &&` is gated in org-controls.ts, so the flag must include
    // `org.simulated` — otherwise a live org with no number could not go back.
    expect(source).toMatch(/blockedFromLive = org\.simulated &&/);
  });
});
