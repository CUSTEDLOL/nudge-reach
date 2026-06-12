import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY =
    "test-key-0123456789abcdef0123456789abcdef";
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const token = "EAAG-very-secret-whatsapp-token-12345";
    const stored = encryptSecret(token);
    expect(stored).not.toContain(token);
    expect(decryptSecret(stored)).toBe(token);
  });

  it("produces a different ciphertext every time (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/crypto");
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("fails loudly on tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const stored = encryptSecret("secret");
    const parts = stored.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${Buffer.from("evil-data-here")
      .toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
