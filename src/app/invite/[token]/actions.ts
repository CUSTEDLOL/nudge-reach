"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  completeOwnerSetup,
  validateOwnerPassword,
} from "@/modules/orgs/owner-setup";

export interface OwnerSetupActionState {
  status: "idle" | "error" | "existing_account" | "account_created";
  message: string;
}

export async function completeOwnerSetupAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return {
      status: "error",
      message: "This setup link is invalid or incomplete. Ask Nudge for a new link.",
    };
  }
  if (password.length > 1_024 || confirmation.length > 1_024) {
    return { status: "error", message: "Enter a valid password." };
  }
  const passwordError = validateOwnerPassword(password, confirmation);
  if (passwordError) return { status: "error", message: passwordError };

  const result = await completeOwnerSetup(token, password);
  if (!result.ok) {
    return {
      status: result.code === "existing_account" ? "existing_account" : "error",
      message: result.message,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: result.email,
      password,
    });
    if (error) {
      return {
        status: "account_created",
        message:
          "Your account is ready, but we couldn't sign you in automatically. Sign in to continue.",
      };
    }
  } catch {
    return {
      status: "account_created",
      message:
        "Your account is ready, but we couldn't sign you in automatically. Sign in to continue.",
    };
  }

  redirect("/onboarding");
}

