import { describe, expect, it } from "vitest";
import {
  describeMessageTiming,
  describeSituation,
  parseFollowUpSpec,
  shouldCancelOnSignal,
  specErrorMessage,
  STOP_SIGNALS,
} from "@/modules/followup/spec";

const quiet = {
  name: "Pricing chase",
  situation: { kind: "went_quiet", afterDays: 2 },
  messages: [
    { afterDays: 0, category: "MARKETING", header: "Still deciding?", body: "Hi {{1}}, happy to answer any questions.", footer: "" },
    { afterDays: 5, category: "MARKETING", header: "One last note", body: "Hi {{1}}, we're here whenever you're ready.", footer: "Reply STOP to unsubscribe" },
  ],
};

const booked = {
  name: "Booking thanks",
  situation: { kind: "booked" },
  messages: [{ afterDays: 0, category: "UTILITY", header: "Booked", body: "Hi {{1}}, you're booked.", footer: "" }],
};

describe("parseFollowUpSpec", () => {
  it("accepts a valid spec and defaults stopOn to every signal", () => {
    const r = parseFollowUpSpec(quiet);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.stopOn).toEqual([...STOP_SIGNALS]);
  });

  it("repairs a marketing message: adds {{1}} and the STOP footer", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ afterDays: 0, category: "MARKETING", header: "Hello", body: "Thinking it over?", footer: "" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.messages[0].body.match(/\{\{1\}\}/g)).toHaveLength(1);
    expect(r.spec.messages[0].footer.toLowerCase()).toContain("stop");
  });

  it("leaves a UTILITY footer alone", () => {
    const r = parseFollowUpSpec(booked);
    expect(r.ok && r.spec.messages[0].footer).toBe("");
  });

  it("a booked spec with no stopOn defaults to booking only — neither a reply nor a payment ends it", () => {
    const r = parseFollowUpSpec(booked);
    expect(r.ok && r.spec.stopOn).toEqual(["booking"]);
  });

  it("a booked spec that names stopOn keeps it", () => {
    const r = parseFollowUpSpec({ ...booked, stopOn: ["reply"] });
    expect(r.ok && r.spec.stopOn).toEqual(["reply"]);
  });

  it("rejects an unknown situation or a gap over 14 days", () => {
    expect(parseFollowUpSpec({ ...quiet, situation: { kind: "birthday" } }).ok).toBe(false);
    expect(
      parseFollowUpSpec({ ...quiet, messages: [{ ...quiet.messages[0], afterDays: 15 }] }).ok
    ).toBe(false);
  });

  it("forces the first message of a went_quiet spec to send immediately", () => {
    const r = parseFollowUpSpec({ ...quiet, messages: [{ ...quiet.messages[0], afterDays: 3 }] });
    expect(r.ok && r.spec.messages[0].afterDays).toBe(0);
  });

  it("rejects an over-long body instead of truncating it after the {{1}} repair", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], body: `Hi {{1}}, ${"x".repeat(600)}` }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.startsWith("messages.0.body")).toBe(true);
  });

  it("drops unknown stopOn entries instead of rejecting the spec", () => {
    const r = parseFollowUpSpec({ ...quiet, stopOn: ["reply", "opt_out", "nonsense"] });
    expect(r.ok && r.spec.stopOn).toEqual(["reply"]);
  });

  it("cuts a 70-character header to 60", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], header: "h".repeat(70) }],
    });
    expect(r.ok && r.spec.messages[0].header).toHaveLength(60);
  });

  it("never strands a surrogate when cutting a header on an emoji", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], header: `${"A".repeat(59)}😀 tail` }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.messages[0].header.isWellFormed()).toBe(true);
    expect(r.spec.messages[0].header.length).toBeLessThanOrEqual(60);
  });
});

describe("specErrorMessage", () => {
  it("turns each field's zod complaint into a sentence the owner can act on", () => {
    expect(specErrorMessage("messages.0.body: Too big: expected string to have <=600 characters")).toBe(
      "Each message needs a body of 1–600 characters."
    );
    expect(specErrorMessage("messages.1.header: Too small: expected string to have >=1 characters")).toBe(
      "Each message needs a headline of 1–60 characters."
    );
    expect(specErrorMessage("messages.0.footer: Too big: expected string to have <=60 characters")).toBe(
      "Keep the footer under 60 characters."
    );
    expect(specErrorMessage("situation.afterDays: Expected int, received number")).toBe(
      "The timing has to be a whole number of days, up to 14."
    );
    expect(specErrorMessage("situation: Invalid discriminator value")).toBe(
      "We couldn't tell what should start that follow-up — try rewording it."
    );
    expect(specErrorMessage("messages: Too small: expected array to have >=1 items")).toBe(
      "A follow-up needs between one and 3 messages."
    );
    expect(specErrorMessage("name: Too big: expected string to have <=80 characters")).toBe(
      "Give the follow-up a short name (1–80 characters)."
    );
  });

  it("reads the leaf of the path, not a substring of it", () => {
    // "keywords" contains "word", "headerless" would contain "header": only the
    // last segment decides, and a nested situation field keeps its own sentence.
    expect(specErrorMessage("situation.keywords.0: Too small")).toBe(
      "We couldn't tell what should start that follow-up — try rewording it."
    );
    expect(specErrorMessage("messages.0.buttons.1.text: Too big")).toBe(
      "That follow-up isn't valid — try rewording it."
    );
  });

  it("falls back to a plain sentence for anything else", () => {
    expect(specErrorMessage("spec: That follow-up isn't valid.")).toBe(
      "That follow-up isn't valid — try rewording it."
    );
    expect(specErrorMessage("stopOn.0: Invalid option")).toBe(
      "That follow-up isn't valid — try rewording it."
    );
    expect(specErrorMessage("")).toBe("That follow-up isn't valid — try rewording it.");
  });

  it("never leaks a raw zod string from a real parse failure", () => {
    const r = parseFollowUpSpec({
      ...quiet,
      messages: [{ ...quiet.messages[0], body: `Hi {{1}}, ${"x".repeat(700)}` }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const owner = specErrorMessage(r.error);
    expect(owner).toBe("Each message needs a body of 1–600 characters.");
    expect(owner).not.toContain("expected");
  });

  it("says what the field needs, not which way it is wrong — a cleared headline reads right too", () => {
    const r = parseFollowUpSpec({ ...quiet, messages: [{ ...quiet.messages[0], header: "   " }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(specErrorMessage(r.error)).toBe("Each message needs a headline of 1–60 characters.");
  });
});

describe("plain-English descriptions", () => {
  it("describes each situation for the card", () => {
    expect(describeSituation({ kind: "went_quiet", afterDays: 2 })).toBe(
      "When someone shows interest, then goes quiet for 2 days"
    );
    expect(describeSituation({ kind: "went_quiet", afterDays: 1, stage: "QUALIFIED" })).toBe(
      "When a qualified lead goes quiet for 1 day"
    );
    expect(describeSituation({ kind: "booked" })).toBe("When someone books an appointment");
    expect(describeSituation({ kind: "keyword", keywords: ["price", "cost"] })).toBe(
      'When a message contains "price" or "cost"'
    );
    expect(describeSituation({ kind: "new_lead" })).toBe("When someone messages for the first time");
    expect(describeSituation({ kind: "campaign_reply" })).toBe("When someone replies to a campaign");
  });

  it("describes message timing relative to the previous message", () => {
    expect(describeMessageTiming(0, 0)).toBe("Right away");
    expect(describeMessageTiming(0, 2)).toBe("2 days later");
    expect(describeMessageTiming(1, 1)).toBe("Then 1 day later");
    expect(describeMessageTiming(1, 0)).toBe("Then right away");
  });
});

describe("shouldCancelOnSignal", () => {
  const chase = { situation: { kind: "went_quiet", afterDays: 2 } };
  const afterBooking = { situation: { kind: "booked" }, stopOn: ["booking"] };

  it("a payment cancels a chase on its default stopOn, but not a booked follow-up on its default", () => {
    const b = parseFollowUpSpec(booked);
    const q = parseFollowUpSpec(quiet);
    expect(b.ok && q.ok).toBe(true);
    if (!b.ok || !q.ok) return;
    expect(shouldCancelOnSignal(b.spec, "payment")).toBe(false);
    expect(shouldCancelOnSignal(q.spec, "payment")).toBe(true);
  });
  it("an opt-out always cancels, whatever the spec says", () => {
    expect(shouldCancelOnSignal({ stopOn: [] }, "opt_out")).toBe(true);
    expect(shouldCancelOnSignal(afterBooking, "opt_out")).toBe(true);
  });
  it("a reply cancels a chase even when stopOn is empty", () => {
    expect(shouldCancelOnSignal({ ...chase, stopOn: [] }, "reply")).toBe(true);
    expect(shouldCancelOnSignal({ stopOn: ["booking"] }, "reply")).toBe(true);
  });
  it("a reply does not cancel a booked-situation follow-up unless its stopOn says so", () => {
    expect(shouldCancelOnSignal(afterBooking, "reply")).toBe(false);
    expect(shouldCancelOnSignal({ ...afterBooking, stopOn: ["reply", "booking"] }, "reply")).toBe(true);
  });
  it("honours stopOn for booking and payment, defaulting to cancel when there is no spec", () => {
    expect(shouldCancelOnSignal({ ...chase, stopOn: ["reply"] }, "booking")).toBe(false);
    expect(shouldCancelOnSignal({ ...chase, stopOn: ["reply", "payment"] }, "payment")).toBe(true);
    expect(shouldCancelOnSignal({ stopOn: ["reply"] }, "booking")).toBe(true);
    expect(shouldCancelOnSignal(null, "booking")).toBe(true);
    expect(shouldCancelOnSignal("garbage", "payment")).toBe(true);
  });
});
