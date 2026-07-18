"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

/**
 * The AI Agent page's two faces: Training (the recurring workflow — answer
 * the agent's questions, tend the fact library) and Setup (set-once persona).
 * Panels stay mounted while hidden so form state survives tab hops; the
 * ?tab= param is kept in sync for deep links (e.g. /agent?tab=setup from
 * the old settings URL).
 */
export function AgentTabs({
  initialTab,
  pendingCount,
  training,
  setup,
}: {
  initialTab?: string;
  pendingCount: number;
  training: ReactNode;
  setup: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab === "setup" ? "setup" : "training");

  function select(next: string) {
    setTab(next);
    window.history.replaceState(
      null,
      "",
      next === "setup" ? "?tab=setup" : window.location.pathname
    );
  }

  return (
    <div>
      <Tabs
        aria-label="AI Agent sections"
        className="mb-6"
        value={tab}
        onValueChange={select}
        items={[
          {
            value: "training",
            label: "Training",
            count: pendingCount > 0 ? pendingCount : undefined,
          },
          { value: "setup", label: "Setup" },
        ]}
      />
      <div hidden={tab !== "training"}>{training}</div>
      <div hidden={tab !== "setup"}>{setup}</div>
    </div>
  );
}
