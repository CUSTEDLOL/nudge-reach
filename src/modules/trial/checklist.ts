import type { TrialWorkspace } from "./workspace";

export type TrialChecklistKey = "teach" | "test" | "explore" | "demo";

export interface TrialChecklistItem {
  key: TrialChecklistKey;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export function buildTrialChecklist(
  workspace: TrialWorkspace,
): TrialChecklistItem[] {
  return [
    {
      key: "teach",
      label: "Teach your AI",
      description: "Approve the clinic facts it is allowed to use.",
      href: "/agent",
      done: workspace.knowledgeReady,
    },
    {
      key: "test",
      label: "Test a real question",
      description: "Message it exactly like a patient would.",
      href: "/inbox/try",
      done: Boolean(workspace.firstReplyAt),
    },
    {
      key: "explore",
      label: "Explore the full Front Desk",
      description: "Preview the business actions available after setup.",
      href: "/explore",
      done: workspace.exploreViewed,
    },
    {
      key: "demo",
      label: "Plan your live setup",
      description: "Book a free demo when you are ready to connect systems.",
      href: "#trial-conversion",
      done: workspace.demoBooked,
    },
  ];
}
