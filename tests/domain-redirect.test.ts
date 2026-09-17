import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("canonical hostname redirects", () => {
  it("permanently redirects every www path to the apex hostname", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({
      source: "/:path*",
      has: [{ type: "host", value: "www.nudgeagent.app" }],
      destination: "https://nudgeagent.app/:path*",
      permanent: true,
    });
  });

  it("retains the retired waitlist redirect", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({
      source: "/waitlist",
      destination: "/",
      permanent: true,
    });
  });
});
