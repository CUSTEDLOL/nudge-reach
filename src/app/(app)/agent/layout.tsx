import type { ReactNode } from "react";
import { FrontDeskTabs } from "./front-desk-tabs";

/**
 * Everything under /agent configures the same AI employee, so every one of
 * those pages carries the same tab strip — on narrow screens, where the
 * sidebar's own sub-nav is not there to do the job.
 */
export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FrontDeskTabs />
      {children}
    </>
  );
}
