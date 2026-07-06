"use client";

import { useLayoutEffect } from "react";

/** Routes reached from the landing page inherit its (very large) scroll
 *  offset for a frame; this pins them to the top on mount. */
export function ScrollTop() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
