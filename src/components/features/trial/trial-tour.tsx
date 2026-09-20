"use client";

import { createPortal } from "react-dom";
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, RotateCcw, X } from "lucide-react";
import {
  completeTrialTourAction,
  dismissTrialTourAction,
  restartTrialTourAction,
  saveTrialTourStepAction,
} from "@/app/(app)/trial/actions";
import { Button } from "@/components/ui/button";
import { useMounted, useOverlay } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import {
  TRIAL_TOUR_STEPS,
  nextTrialTourStep,
  previousTrialTourStep,
  trialTourPresentation,
  trialTourStep,
  trialTourTargetSelector,
} from "@/modules/trial/tour";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const RESTART_EVENT = "nudge:trial-tour-restart";
const DESKTOP_PANEL_WIDTH = 360;
const DESKTOP_PANEL_HEIGHT = 320;
const PANEL_GAP = 16;

interface TargetRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

function elementRect(element: Element): TargetRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function TrialTour({ trial }: { trial: TrialWorkspace }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [stepId, setStepId] = useState(trial.tourStep);
  const [open, setOpen] = useState(
    !trial.tourCompleted && !trial.tourDismissed,
  );
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [presentation, setPresentation] = useState<"popover" | "bottom-sheet">(
    "popover",
  );
  const [pending, setPending] = useState(false);
  const step = trialTourStep(stepId);
  const stepIndex = TRIAL_TOUR_STEPS.findIndex(
    (candidate) => candidate.id === step.id,
  );

  const handleDismiss = useCallback(() => {
    setOpen(false);
    startTransition(() => {
      void dismissTrialTourAction();
    });
  }, []);

  useOverlay(mounted && open, handleDismiss, panelRef);

  useEffect(() => {
    function restart() {
      setStepId("welcome");
      setMissingTarget(false);
      setTargetRect(null);
      setOpen(true);
      router.push("/dashboard");
    }
    window.addEventListener(RESTART_EVENT, restart);
    return () => window.removeEventListener(RESTART_EVENT, restart);
  }, [router]);

  useEffect(() => {
    if (!open) return;

    function readViewport() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setPresentation(trialTourPresentation(window.innerWidth));
    }

    readViewport();
    window.addEventListener("resize", readViewport);
    return () => window.removeEventListener("resize", readViewport);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }

    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let measureFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const target = document.querySelector(trialTourTargetSelector(step));
        if (!target) {
          setMissingTarget(true);
          return;
        }
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        target.scrollIntoView({
          block: "center",
          behavior: reduceMotion ? "auto" : "smooth",
        });
        measureFrame = window.requestAnimationFrame(() => {
          if (!cancelled) setTargetRect(elementRect(target));
        });
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.cancelAnimationFrame(measureFrame);
    };
  }, [open, pathname, router, step]);

  useEffect(() => {
    if (!open || missingTarget || pathname !== step.route) return;
    let animationFrame = 0;

    function measure() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const target = document.querySelector(trialTourTargetSelector(step));
        if (target) setTargetRect(elementRect(target));
      });
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [missingTarget, open, pathname, step]);

  async function move(direction: "back" | "next") {
    const destination = direction === "back"
      ? previousTrialTourStep(step.id)
      : nextTrialTourStep(step.id);
    if (!destination) return;

    setPending(true);
    const result = await saveTrialTourStepAction(destination.id);
    setPending(false);
    if (!result.ok) {
      setOpen(false);
      return;
    }
    setStepId(destination.id);
    setMissingTarget(false);
    setTargetRect(null);
    if (pathname !== destination.route) router.push(destination.route);
  }

  async function finish() {
    setPending(true);
    const result = await completeTrialTourAction();
    setPending(false);
    if (result.ok) setOpen(false);
  }

  if (!mounted || !open) return null;

  const showAbove = Boolean(
    targetRect &&
      targetRect.bottom + PANEL_GAP + DESKTOP_PANEL_HEIGHT > viewport.height,
  );
  const popoverTop = targetRect
    ? showAbove
      ? Math.max(PANEL_GAP, targetRect.top - PANEL_GAP - DESKTOP_PANEL_HEIGHT)
      : Math.max(
          PANEL_GAP,
          Math.min(
            viewport.height - DESKTOP_PANEL_HEIGHT - PANEL_GAP,
            targetRect.bottom + PANEL_GAP,
          ),
        )
    : Math.max(PANEL_GAP, (viewport.height - DESKTOP_PANEL_HEIGHT) / 2);
  const popoverLeft = targetRect
    ? Math.min(
        viewport.width - DESKTOP_PANEL_WIDTH - PANEL_GAP,
        Math.max(
          PANEL_GAP,
          targetRect.left + targetRect.width / 2 - DESKTOP_PANEL_WIDTH / 2,
        ),
      )
    : Math.max(PANEL_GAP, (viewport.width - DESKTOP_PANEL_WIDTH) / 2);
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[110]">
      {targetRect && !missingTarget ? (
        <div
          aria-hidden
          className="fixed rounded-xl ring-4 ring-brand-300/90"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: "0 0 0 9999px rgb(5 46 35 / 0.52)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-brand-950/50" />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={
          presentation === "popover"
            ? { top: popoverTop, left: popoverLeft, width: DESKTOP_PANEL_WIDTH }
            : undefined
        }
        className={cn(
          "pointer-events-auto fixed max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white shadow-lift outline-none",
          presentation === "bottom-sheet"
            ? "inset-x-0 bottom-0 w-full rounded-t-2xl border border-black/5 pb-[env(safe-area-inset-bottom)]"
            : "rounded-2xl border border-black/5",
        )}
      >
        {presentation === "bottom-sheet" && (
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-neutral-200"
          />
        )}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
                Step {stepIndex + 1} of {TRIAL_TOUR_STEPS.length}
              </p>
              <h2
                id={titleId}
                className="mt-2 text-lg font-semibold text-neutral-950"
              >
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Skip guided tour"
              className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-neutral-400 outline-none hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-600">{step.body}</p>
          {missingTarget && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              This area is still loading. You can continue and return to it
              later.
            </p>
          )}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="min-h-11 rounded-lg px-2 text-sm font-medium text-neutral-500 outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void move("back")}
                disabled={stepIndex === 0 || pending}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </Button>
              <Button
                type="button"
                onClick={() =>
                  void (step.id === "finish" ? finish() : move("next"))
                }
                disabled={pending}
              >
                {step.id === "finish" ? "Finish" : "Next"}
                {step.id !== "finish" && (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function RestartTrialTourButton() {
  const [pending, setPending] = useState(false);

  async function restart() {
    setPending(true);
    const result = await restartTrialTourAction();
    setPending(false);
    if (!result.ok) return;
    window.dispatchEvent(new Event(RESTART_EVENT));
  }

  return (
    <button
      type="button"
      onClick={() => void restart()}
      disabled={pending}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-neutral-500 outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      Restart guided tour
    </button>
  );
}
