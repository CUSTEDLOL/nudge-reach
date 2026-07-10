import type { KnowledgeCategory } from "./digest";

/**
 * The onboarding questionnaire (pure data, unit-tested). ONE deterministic
 * script powers both modes — the premade form and the chat-style interview —
 * so answers land in the same distillation path either way. No AI asks the
 * questions; AI only distills the answers (cheap, testable, works keyless).
 */

export interface QItem {
  id: string;
  category: KnowledgeCategory;
  prompt: string;
  placeholder: string;
}

/** What we call the sellable things, per curated vertical. */
const OFFERING_WORDS: Record<string, string> = {
  restaurant: "dishes on your menu",
  clinic: "treatments and services",
  salon: "services and treatments",
  retail: "products",
  real_estate: "property types and localities",
};

export function questionnaireScript(vertical: string): QItem[] {
  const offering = OFFERING_WORDS[vertical] ?? "products or services";
  return [
    {
      id: "business_summary",
      category: "other",
      prompt:
        "Describe your business in a few sentences — what do you do, and for whom?",
      placeholder: "We're a family-run…",
    },
    {
      id: "services_list",
      category: "menu_services",
      prompt: `List your main ${offering}, each with its price if you can. The more you write, the smarter your AI gets.`,
      placeholder: "1. … — ₹…\n2. … — ₹…",
    },
    {
      id: "bestsellers",
      category: "menu_services",
      prompt: "What are your bestsellers or most-asked-for items?",
      placeholder: "Customers love our…",
    },
    {
      id: "not_offered",
      category: "menu_services",
      prompt:
        "Anything customers often ask for that you DON'T offer? (So the AI says no correctly.)",
      placeholder: "We don't do…",
    },
    {
      id: "pricing_range",
      category: "pricing",
      prompt: "What's your typical price range, and what affects the price?",
      placeholder: "Most … cost between ₹… and ₹…, depending on…",
    },
    {
      id: "offers",
      category: "pricing",
      prompt:
        "Any current offers, packages, or discounts? Mention when they apply (e.g. weekdays only).",
      placeholder: "10% off on…, valid…",
    },
    {
      id: "hours_weekly",
      category: "hours",
      prompt: "What are your opening hours, day by day?",
      placeholder: "Mon–Sat 10am–8pm, Sun closed",
    },
    {
      id: "hours_special",
      category: "hours",
      prompt: "Any special hours — holidays, festivals, lunch breaks?",
      placeholder: "Closed on Diwali; open till 10pm on weekends",
    },
    {
      id: "location_address",
      category: "location",
      prompt: "What's your full address?",
      placeholder: "Shop 4, …",
    },
    {
      id: "location_landmark",
      category: "location",
      prompt: "How do customers find you? Landmarks, directions, parking?",
      placeholder: "Opposite …, parking available at…",
    },
    {
      id: "service_area",
      category: "location",
      prompt: "Do you deliver or travel to customers? Which areas?",
      placeholder: "We deliver within…",
    },
    {
      id: "booking_policy",
      category: "policies",
      prompt:
        "How do bookings/appointments/orders work? Advance notice, group sizes, cancellation rules?",
      placeholder: "Book at least … in advance; cancellations…",
    },
    {
      id: "returns_refunds",
      category: "policies",
      prompt: "What's your return, refund, or rescheduling policy?",
      placeholder: "Exchanges within 7 days…",
    },
    {
      id: "policies_other",
      category: "policies",
      prompt: "Any other house rules customers should know?",
      placeholder: "No outside food; pets welcome…",
    },
    {
      id: "payment_methods",
      category: "payments",
      prompt: "Which payment methods do you accept?",
      placeholder: "UPI, cards, cash…",
    },
    {
      id: "advance_deposit",
      category: "payments",
      prompt: "Do you take advances or deposits? How much, and when?",
      placeholder: "50% advance for…",
    },
    {
      id: "faq_1",
      category: "faq",
      prompt:
        "What's the #1 question customers always ask — and your answer to it?",
      placeholder: "Q: … A: …",
    },
    {
      id: "faq_2",
      category: "faq",
      prompt: "And the second most common question + answer?",
      placeholder: "Q: … A: …",
    },
    {
      id: "team",
      category: "other",
      prompt:
        "Who's on the team customers might ask for? Specialists, languages spoken?",
      placeholder: "Dr. …, speaks Hindi and English…",
    },
    {
      id: "anything_else",
      category: "other",
      prompt:
        "Anything else your best employee would know? Dump it all here — awards, story, quirks.",
      placeholder: "We've been around since…",
    },
  ];
}

/** Look up one script item (used by the incremental interview action). */
export function scriptItemById(
  vertical: string,
  id: string
): QItem | undefined {
  return questionnaireScript(vertical).find((q) => q.id === id);
}
