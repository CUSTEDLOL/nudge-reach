import { describe, it, expect } from "vitest";
import { csvField, csvRow } from "@/lib/csv";

describe("csvField — formula injection defense (CWE-1236)", () => {
  it.each(["=SUM(A1)", "+91 987", "-secret", "@handle", "\tx", "\rx"])(
    "neutralizes leading formula trigger in %j",
    (value) => {
      expect(csvField(value).startsWith("'") || csvField(value).startsWith("\"'")).toBe(
        true
      );
    }
  );

  it("leaves plain values untouched", () => {
    expect(csvField("Priya Sharma")).toBe("Priya Sharma");
    expect(csvField("9198100001")).toBe("9198100001");
  });

  it("keeps RFC-4180 quoting for commas, quotes and newlines", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("applies both defenses at once", () => {
    // Leading = AND a comma → apostrophe first, then quoting.
    expect(csvField("=cmd,arg")).toBe("\"'=cmd,arg\"");
  });
});

describe("csvRow", () => {
  it("joins encoded cells with commas", () => {
    expect(csvRow(["a", "b,c", "=x"])).toBe('a,"b,c",\'=x');
  });
});
