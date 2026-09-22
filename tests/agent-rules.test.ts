import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_RULES,
  MAX_INSTRUCTION_LENGTH,
  MAX_RULE_TEXT_LENGTH,
  RULE_QUALITY_NUDGE_AT,
  describeRule,
  introducesNewSpecifics,
  renderRulesBlock,
  ruleSchema,
} from "@/modules/agent/rules";

const valid = {
  text: "push everyone coming to inbox to join the waitlist",
  instruction: "Always point customers to the waitlist",
  scope: "always" as const,
};

describe("ruleSchema", () => {
  it("accepts always and never rules", () => {
    expect(ruleSchema.safeParse(valid).success).toBe(true);
    expect(ruleSchema.safeParse({ ...valid, scope: "never" }).success).toBe(true);
  });

  it("accepts a when rule that carries its condition", () => {
    const parsed = ruleSchema.safeParse({
      ...valid,
      scope: "when",
      condition: "someone asks about pricing",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown scope", () => {
    expect(ruleSchema.safeParse({ ...valid, scope: "sometimes" }).success).toBe(false);
  });

  it("requires a condition for scope when, and refuses one otherwise", () => {
    expect(ruleSchema.safeParse({ ...valid, scope: "when" }).success).toBe(false);
    expect(
      ruleSchema.safeParse({ ...valid, condition: "someone asks about pricing" }).success
    ).toBe(false);
  });

  it("caps instruction at 200 characters and text at 500", () => {
    expect(MAX_INSTRUCTION_LENGTH).toBe(200);
    expect(MAX_RULE_TEXT_LENGTH).toBe(500);
    expect(
      ruleSchema.safeParse({ ...valid, instruction: "x".repeat(200) }).success
    ).toBe(true);
    expect(
      ruleSchema.safeParse({ ...valid, instruction: "x".repeat(201) }).success
    ).toBe(false);
    expect(ruleSchema.safeParse({ ...valid, text: "x".repeat(500) }).success).toBe(true);
    expect(ruleSchema.safeParse({ ...valid, text: "x".repeat(501) }).success).toBe(false);
  });

  it("rejects an empty rule", () => {
    expect(ruleSchema.safeParse({ ...valid, text: "   " }).success).toBe(false);
    expect(ruleSchema.safeParse({ ...valid, instruction: "" }).success).toBe(false);
  });
});

describe("the caps", () => {
  it("allows 5 active rules in the trial and 20 in the full app", () => {
    expect(MAX_ACTIVE_RULES).toEqual({ trial: 5, full: 20 });
  });

  it("nudges on quality before the full cap is reached", () => {
    expect(RULE_QUALITY_NUDGE_AT).toBe(10);
    expect(RULE_QUALITY_NUDGE_AT).toBeLessThan(MAX_ACTIVE_RULES.full);
  });
});

describe("describeRule", () => {
  const text = "point people to the waitlist";

  it("prefixes by scope", () => {
    expect(describeRule({ scope: "always", text })).toBe(`Always: ${text}`);
    expect(describeRule({ scope: "never", text })).toBe(`Never: ${text}`);
    expect(
      describeRule({ scope: "when", text, condition: "someone asks about pricing" })
    ).toBe(`When someone asks about pricing: ${text}`);
  });

  it("tolerates a null condition from the database without claiming a scope", () => {
    // A "when" row with no condition is a data error; stating the rule plainly
    // is honest, where "Always:" would misrepresent it.
    expect(describeRule({ scope: "when", text, condition: null })).toBe(text);
  });
});

describe("introducesNewSpecifics", () => {
  it("accepts a distillation that repeats the owner's own URL", () => {
    expect(
      introducesNewSpecifics(
        "push the waitlist at https://getgutfeeling.in/",
        "Always point customers to https://getgutfeeling.in/"
      )
    ).toBe(false);
  });

  it("rejects an invented URL", () => {
    expect(
      introducesNewSpecifics(
        "push the waitlist",
        "Always point customers to https://evil.example/"
      )
    ).toBe(true);
  });

  it("rejects an invented bare domain, with no scheme to give it away", () => {
    expect(introducesNewSpecifics("push the waitlist", "Send them to evil.example")).toBe(
      true
    );
  });

  it("rejects a different email address", () => {
    expect(introducesNewSpecifics("email admin@x.com", "Email support@x.com")).toBe(true);
  });

  it("rejects a different number", () => {
    expect(introducesNewSpecifics("consults are ₹500", "Consults cost ₹900")).toBe(true);
  });

  it("accepts the same number restated", () => {
    expect(introducesNewSpecifics("consults are ₹500", "Tell them consults are ₹500")).toBe(
      false
    );
  });

  it("ignores case, www. and a trailing slash on the same URL", () => {
    expect(
      introducesNewSpecifics(
        "the waitlist is at HTTPS://WWW.GetGutFeeling.in/",
        "Point them to https://getgutfeeling.in"
      )
    ).toBe(false);
  });

  it("ignores a trailing full stop the sentence put on a URL", () => {
    expect(
      introducesNewSpecifics("sign up at https://x.com.", "Send them to https://x.com")
    ).toBe(false);
  });

  it("rejects a different path on a host the owner did mention", () => {
    expect(
      introducesNewSpecifics("book at https://x.com/waitlist", "Send them to https://x.com/pay")
    ).toBe(true);
  });

  it("accepts a number the original had inside a word", () => {
    expect(introducesNewSpecifics("we stock B12 shots", "Recommend the B12 shot")).toBe(
      false
    );
    expect(introducesNewSpecifics("we are open 24/7", "Say we are open 24/7")).toBe(false);
  });

  it("ignores thousands separators on an unchanged price", () => {
    expect(introducesNewSpecifics("consults are ₹1,499", "Consults cost ₹1499")).toBe(false);
  });

  it("rejects a price whose digits appear in the original only as something else", () => {
    // "24" is in the original as opening hours, not as money: a rupee amount
    // is a new specific even though the digits are familiar.
    expect(introducesNewSpecifics("we are open 24/7", "Consults cost ₹24")).toBe(true);
  });

  it("rejects a changed phone number", () => {
    expect(
      introducesNewSpecifics("call us on +91 98765 43210", "Tell them to call +91 98765 43211")
    ).toBe(true);
  });

  it("does not let an email in the original license a website in the distillation", () => {
    expect(introducesNewSpecifics("mail us at admin@x.com", "Send them to x.com")).toBe(true);
  });

  it("is total: never throws on empty, emoji or very long input", () => {
    expect(introducesNewSpecifics("", "")).toBe(false);
    expect(introducesNewSpecifics("", "Always greet people warmly")).toBe(false);
    expect(introducesNewSpecifics("🙂🎉", "Be warm 🙂")).toBe(false);
    const long = `${"a".repeat(50_000)} https://x.com/${"b".repeat(5_000)}`;
    expect(() => introducesNewSpecifics(long, long)).not.toThrow();
    expect(() => introducesNewSpecifics("hi", long)).not.toThrow();
  });

  it("accepts a pure rephrasing that adds no specifics at all", () => {
    expect(
      introducesNewSpecifics(
        "Action item to push everyone coming to inbox to join the waitlist",
        "Always invite the customer to join the waitlist"
      )
    ).toBe(false);
  });
});

describe("renderRulesBlock", () => {
  it("returns nothing for an org with no rules, so the prompt is unchanged", () => {
    expect(renderRulesBlock([])).toBe("");
  });

  it("renders the house rules block above whatever follows it", () => {
    expect(
      renderRulesBlock([
        { instruction: "Always point people to the waitlist at https://getgutfeeling.in/" },
        { instruction: "Never quote a price; offer a consultation instead" },
      ])
    ).toBe(
      [
        "HOUSE RULES — follow these in every reply, even when the knowledge below points elsewhere:",
        "- Always point people to the waitlist at https://getgutfeeling.in/",
        "- Never quote a price; offer a consultation instead",
      ].join("\n")
    );
  });
});
