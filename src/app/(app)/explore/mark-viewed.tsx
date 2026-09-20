"use client";

import { useEffect } from "react";
import { markTrialExploreViewedAction } from "@/app/(app)/trial/actions";

export function MarkExploreViewed() {
  useEffect(() => {
    void markTrialExploreViewedAction();
  }, []);
  return null;
}
