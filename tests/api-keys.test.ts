import { describe, expect, it } from "vitest";
import {
  API_KEY_PREFIX,
  displayPrefix,
  generateApiKey,
  hashApiKey,
} from "@/lib/api-keys";

describe("generateApiKey", () => {
  it("starts with the nk_live_ prefix", () => {
    expect(generateApiKey().startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("has 24 random characters after the prefix", () => {
    const key = generateApiKey();
    expect(key.length).toBe(API_KEY_PREFIX.length + 24);
  });

  it("uses only URL-safe alphanumerics in the random part", () => {
    for (let i = 0; i < 20; i++) {
      const random = generateApiKey().slice(API_KEY_PREFIX.length);
      expect(random).toMatch(/^[a-zA-Z0-9]{24}$/);
    }
  });

  it("never repeats (crypto randomness)", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey()));
    expect(keys.size).toBe(200);
  });
});

describe("hashApiKey", () => {
  it("is a deterministic sha256 hex digest", () => {
    const key = generateApiKey();
    const hash = hashApiKey(key);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not contain the key material", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).not.toContain(key.slice(API_KEY_PREFIX.length));
  });

  it("differs for different keys", () => {
    expect(hashApiKey(generateApiKey())).not.toBe(
      hashApiKey(generateApiKey())
    );
  });
});

describe("displayPrefix", () => {
  it("keeps the prefix plus 4 characters for tables", () => {
    const key = `${API_KEY_PREFIX}abcd1234efgh5678ijkl9012`;
    expect(displayPrefix(key)).toBe(`${API_KEY_PREFIX}abcd`);
  });
});
