import { describe, expect, it } from "vitest";
import { visibleChoiceValue } from "@/app/(app)/onboarding/question-state";

describe("onboarding question state", () => {
  it("keeps an unanswered question visually blank", () => {
    expect(visibleChoiceValue("owner", 1, 0)).toBe("");
    expect(visibleChoiceValue("enquiry-booking-payment", 3, 2)).toBe("");
  });

  it("restores the saved value for completed questions", () => {
    expect(visibleChoiceValue("owner", 1, 1)).toBe("owner");
    expect(visibleChoiceValue("bookings", 2, 6)).toBe("bookings");
  });
});
