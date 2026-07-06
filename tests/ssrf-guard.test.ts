import { describe, it, expect, vi } from "vitest";

// The module imports prisma; stub it (these helpers don't touch the DB).
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  isBlockedIp,
  assertPublicHttpsUrl,
} from "@/modules/integrations/outbound-webhooks";

describe("isBlockedIp — SSRF address filter", () => {
  it("blocks loopback / private / link-local / metadata / CGNAT", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
      "100.64.0.1",
      "::1",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1", // IPv4-mapped loopback
    ]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it("allows genuine public addresses", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "172.15.0.1", // just below the private block
      "172.32.0.1", // just above it
      "93.184.216.34",
      "2606:4700::1111",
    ]) {
      expect(isBlockedIp(ip)).toBe(false);
    }
  });
});

describe("assertPublicHttpsUrl", () => {
  it("rejects non-https", async () => {
    await expect(assertPublicHttpsUrl("http://8.8.8.8/hook")).rejects.toThrow(
      /https/
    );
  });

  it("rejects private / metadata IP hosts", async () => {
    await expect(
      assertPublicHttpsUrl("https://127.0.0.1/hook")
    ).rejects.toThrow(/private|reserved/);
    await expect(
      assertPublicHttpsUrl("https://169.254.169.254/latest/meta-data")
    ).rejects.toThrow();
  });

  it("allows a public-IP https host", async () => {
    await expect(
      assertPublicHttpsUrl("https://8.8.8.8/hook")
    ).resolves.toBeUndefined();
  });

  it("rejects a malformed URL", async () => {
    await expect(assertPublicHttpsUrl("not a url")).rejects.toThrow();
  });
});
