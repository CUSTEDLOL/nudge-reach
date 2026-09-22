import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/safe-redirect";
import { markAcquisitionTrialEmailVerified } from "@/modules/trial/email-verification";

async function markVerifiedTrialEmail(
  user: { id?: string; email?: string | null } | null | undefined,
) {
  if (!user?.id || !user.email) return;

  try {
    await markAcquisitionTrialEmailVerified({
      userId: user.id,
      email: user.email,
    });
  } catch {
    // Email proof is optional. Keep the valid session and safe redirect; the
    // dashboard reminder can send another link later.
  }
}

// Email confirmation / magic-link / password-recovery landing. Supabase's
// default templates arrive here as a PKCE `code`; the token_hash form works
// cross-device (open the email on your phone, signed up on your laptop).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Only same-site relative paths — never an attacker-controlled host.
  const next = safeRelativePath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      await markVerifiedTrialEmail(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await markVerifiedTrialEmail(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
