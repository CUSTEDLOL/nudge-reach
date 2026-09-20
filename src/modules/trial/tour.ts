import type { TrialTourStep } from "./workspace";

export interface TrialTourStepDefinition {
  id: TrialTourStep;
  route: "/dashboard" | "/agent" | "/inbox/try" | "/explore";
  target: string;
  title: string;
  body: string;
}

export const TRIAL_TOUR_STEPS = [
  {
    id: "welcome",
    route: "/dashboard",
    target: "trial-home",
    title: "Your trial starts here",
    body: "Use this short checklist to train your Front Desk, test a patient question, and preview the paid setup.",
  },
  {
    id: "train",
    route: "/agent",
    target: "training-source",
    title: "Keep every reply grounded",
    body: "These approved clinic facts are all your AI can use. Edit them here whenever something changes.",
  },
  {
    id: "test",
    route: "/inbox/try",
    target: "test-composer",
    title: "Ask a real patient question",
    body: "Choose a starter or type your own question. This runs through the same agent path as a real WhatsApp message.",
  },
  {
    id: "inbox",
    route: "/inbox/try",
    target: "test-thread",
    title: "See the answer as a conversation",
    body: "Your private thread keeps the customer question and Nudge reply together. Nothing is sent to a real phone.",
  },
  {
    id: "locked",
    route: "/explore",
    target: "locked-whatsapp",
    title: "Preview the live setup",
    body: "Paid features stay safely locked in the trial. Open a card to book a demo or compare plans.",
  },
  {
    id: "finish",
    route: "/dashboard",
    target: "trial-conversion",
    title: "Ready to go live?",
    body: "Book a free demo so we can connect your real WhatsApp number, calendar, payments, and follow-up flow.",
  },
] as const satisfies readonly TrialTourStepDefinition[];

const TRIAL_TOUR_STEP_IDS = new Set<TrialTourStep>(
  TRIAL_TOUR_STEPS.map((step) => step.id),
);

export function isTrialTourStep(value: string): value is TrialTourStep {
  return TRIAL_TOUR_STEP_IDS.has(value as TrialTourStep);
}

export function trialTourStep(id: TrialTourStep): TrialTourStepDefinition {
  return TRIAL_TOUR_STEPS.find((step) => step.id === id) ?? TRIAL_TOUR_STEPS[0];
}

export function nextTrialTourStep(
  id: TrialTourStep,
): TrialTourStepDefinition | null {
  const index = TRIAL_TOUR_STEPS.findIndex((step) => step.id === id);
  return TRIAL_TOUR_STEPS[index + 1] ?? null;
}

export function previousTrialTourStep(
  id: TrialTourStep,
): TrialTourStepDefinition | null {
  const index = TRIAL_TOUR_STEPS.findIndex((step) => step.id === id);
  return index > 0 ? TRIAL_TOUR_STEPS[index - 1] : null;
}

export function trialTourTargetSelector(step: TrialTourStepDefinition) {
  return `[data-tour="${step.target}"]`;
}

export function trialTourPresentation(width: number) {
  return width < 768 ? "bottom-sheet" as const : "popover" as const;
}
