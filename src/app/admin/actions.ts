"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin-server";
import { isAuthorizedFounder } from "@/modules/admin/auth";

export interface FounderLoginState {
  ok: false;
  message: string;
}

const GENERIC_AUTH_ERROR =
  "Email or password is incorrect, or this account is not authorized.";

export async function loginFounderAction(
  _previousState: FounderLoginState,
  formData: FormData
): Promise<FounderLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password || email.length > 254 || password.length > 1024) {
    return { ok: false, message: "Enter a valid email and password." };
  }

  const supabase = await createAdminClient();
  let result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch {
    return {
      ok: false,
      message: "We couldn't sign you in right now. Please try again.",
    };
  }

  const user = result.data.user;
  if (
    result.error
    || !isAuthorizedFounder(
      user?.email,
      user?.app_metadata,
      env.FOUNDER_EMAILS,
    )
  ) {
    if (result.data.user) {
      try {
        await supabase.auth.signOut();
      } catch {
        // The allowlist still denies access even if session cleanup fails.
      }
    }
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  redirect("/admin");
}
