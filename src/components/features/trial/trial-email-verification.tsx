"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function trialVerificationStorageKeys(trialId: string) {
  return {
    sent: `nudge:trial:${trialId}:verification-sent`,
    dismissed: `nudge:trial:${trialId}:verification-dismissed`,
  };
}

export function trialVerificationRedirect(origin: string) {
  return `${origin}/auth/confirm?next=/dashboard`;
}

export function TrialEmailVerification({
  trialId,
  email,
}: {
  trialId: string;
  email: string;
}) {
  const requestedOnMount = useRef(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(
        window.localStorage.getItem(
          trialVerificationStorageKeys(trialId).dismissed,
        ),
      );
    } catch {
      return false;
    }
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendVerification = useCallback(async () => {
    setMessage(null);
    setError(null);

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
        window.localStorage.setItem(
          trialVerificationStorageKeys(trialId).sent,
          "true",
        );
      } catch {
        // A privacy-restricted browser can still receive the email.
      }
      setMessage("Verification email sent.");
    } catch {
      setError("Could not send the verification email. Try again.");
    }
  }, [email, trialId]);

  useEffect(() => {
    if (requestedOnMount.current) return;

    try {
      const keys = trialVerificationStorageKeys(trialId);
      if (window.localStorage.getItem(keys.dismissed)) return;
      if (window.localStorage.getItem(keys.sent)) return;
    } catch {
      // Continue without browser storage; sending remains optional and safe.
    }

    requestedOnMount.current = true;
    queueMicrotask(() => void sendVerification());
  }, [sendVerification, trialId]);

  function dismiss() {
    try {
      window.localStorage.setItem(
        trialVerificationStorageKeys(trialId).dismissed,
        "true",
      );
    } catch {
      // Dismissing remains local even when storage is unavailable.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

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
      {message ? <span role="status"> {message}</span> : null}
      {error ? <span role="alert"> {error}</span> : null}
    </p>
  );
}
