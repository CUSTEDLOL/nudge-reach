import type { ReactNode } from "react";
import { FrontDeskTabs } from "./front-desk-tabs";

/**
 * Everything under /agent configures the same AI employee, so every one of
 * those pages carries the same tab strip.
 */
export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FrontDeskTabs />
      {children}
    </>
  );
}
