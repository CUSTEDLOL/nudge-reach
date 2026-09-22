"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TrialVerificationStatus =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error" };

interface TrialVerificationState {
  storageResolved: boolean;
  dismissed: boolean;
  sent: boolean;
  latestRequestId: number;
  status: TrialVerificationStatus;
}

export function trialVerificationStorageKeys(trialId: string) {
  return {
    sent: `nudge:trial:${trialId}:verification-sent`,
    dismissed: `nudge:trial:${trialId}:verification-dismissed`,
  };
}

export function trialVerificationRedirect(origin: string) {
  return `${origin}/auth/confirm?next=/dashboard`;
}

export function initialTrialVerificationState(): TrialVerificationState {
  return {
    storageResolved: false,
    dismissed: false,
    sent: false,
    latestRequestId: 0,
    status: { kind: "idle" },
  };
}

export function resolveTrialVerificationStorage(
  state: TrialVerificationState,
  snapshot: { dismissed: boolean; sent: boolean },
): TrialVerificationState {
  return {
    ...state,
    storageResolved: true,
    dismissed: snapshot.dismissed,
    sent: state.sent || snapshot.sent,
  };
}

export function startTrialVerificationRequest(
  state: TrialVerificationState,
  requestId: number,
): TrialVerificationState {
  return { ...state, latestRequestId: requestId, status: { kind: "idle" } };
}

export function completeTrialVerificationRequest(
  state: TrialVerificationState,
  requestId: number,
  status: "success" | "error",
): TrialVerificationState {
  if (requestId !== state.latestRequestId) return state;
  return {
    ...state,
    sent: state.sent || status === "success",
    status: { kind: status },
  };
}

export function markTrialVerificationSent(
  storage: Pick<Storage, "setItem">,
  trialId: string,
) {
  storage.setItem(trialVerificationStorageKeys(trialId).sent, "true");
}

function trialVerificationStorageSnapshot(trialId: string) {
  try {
    const keys = trialVerificationStorageKeys(trialId);
    return {
      dismissed: Boolean(window.localStorage.getItem(keys.dismissed)),
      sent: Boolean(window.localStorage.getItem(keys.sent)),
    };
  } catch {
    return { dismissed: false, sent: false };
  }
}

export function TrialEmailVerification({
  trialId,
  email,
}: {
  trialId: string;
  email: string;
}) {
  const requestedOnMount = useRef(false);
  const latestRequestId = useRef(0);
  const [state, setState] = useState(initialTrialVerificationState);

  const sendVerification = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setState((current) => startTrialVerificationRequest(current, requestId));

    try {
      const { error: otpError } = await createClient().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: trialVerificationRedirect(window.location.origin),
        },
      });
      if (otpError) throw otpError;

      try {
        markTrialVerificationSent(window.localStorage, trialId);
      } catch {
        // A privacy-restricted browser can still receive the email.
      }
      setState((current) =>
        completeTrialVerificationRequest(current, requestId, "success"),
      );
    } catch {
      setState((current) =>
        completeTrialVerificationRequest(current, requestId, "error"),
      );
    }
  }, [email, trialId]);

  useEffect(() => {
    const snapshot = trialVerificationStorageSnapshot(trialId);
    queueMicrotask(() => {
      setState((current) => resolveTrialVerificationStorage(current, snapshot));
    });
  }, [trialId]);

  useEffect(() => {
    if (
      !state.storageResolved ||
      state.dismissed ||
      state.sent ||
      requestedOnMount.current
    ) {
      return;
    }

    requestedOnMount.current = true;
    queueMicrotask(() => void sendVerification());
  }, [sendVerification, state.dismissed, state.sent, state.storageResolved]);

  function dismiss() {
    try {
      window.localStorage.setItem(
        trialVerificationStorageKeys(trialId).dismissed,
        "true",
      );
    } catch {
      // Dismissing remains local even when storage is unavailable.
    }
    setState((current) => ({ ...current, dismissed: true }));
  }

  if (state.dismissed) return null;

  return (
    <p className="mt-1 text-xs leading-5 text-brand-900/65">
      Verify your email to protect this workspace.{" "}
      <button
        type="button"
        onClick={() => void sendVerification()}
        className="font-medium text-brand-900 underline decoration-brand-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Resend email
      </button>{" "}
      <button
        type="button"
        onClick={dismiss}
        className="font-medium text-brand-900 underline decoration-brand-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Dismiss
      </button>
      {state.status.kind === "success" ? (
        <span role="status"> Verification email sent.</span>
      ) : null}
      {state.status.kind === "error" ? (
        <span role="alert"> Could not send the verification email. Try again.</span>
      ) : null}
    </p>
  );
}
