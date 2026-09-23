import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Setup page is retired: Training is the one place the AI is configured.
 * Its route has to keep answering, though — it is in owners' history, in old
 * emails and in the dashboard checklist they clicked last week — so it sends
 * them to Training rather than 404ing.
 *
 * Asserted here because a signed-out request never reaches these pages (the
 * proxy sends it to /login first), so curl cannot show the redirect.
 */

const { permanentRedirect } = vi.hoisted(() => ({ permanentRedirect: vi.fn() }));
vi.mock("next/navigation", () => ({ permanentRedirect }));

import AgentSetupRedirect from "@/app/(app)/agent/setup/page";
import AgentSettingsRedirect from "@/app/(app)/settings/agent/page";

describe("the retired Setup routes", () => {
  beforeEach(() => permanentRedirect.mockClear());

  it("sends /agent/setup to Training", () => {
    AgentSetupRedirect();
    expect(permanentRedirect).toHaveBeenCalledWith("/agent");
  });

  it("sends the older /settings/agent straight there too, not through a second hop", () => {
    AgentSettingsRedirect();
    expect(permanentRedirect).toHaveBeenCalledWith("/agent");
  });
});
