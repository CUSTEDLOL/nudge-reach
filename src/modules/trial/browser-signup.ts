import type { AttributionSnapshot } from "@/modules/marketing/analytics";

export type TrialSignupValues = {
  ownerName: string;
  businessName: string;
  email: string;
  phone: string;
  password: string;
  contactConsent: boolean;
  honeypot: string;
};

export type TrialClaimResponse = {
  trialId: string;
  claimToken: string;
  expiresAt?: string;
};

export type TrialIntakeResponse =
  | { ok: true; claim: TrialClaimResponse }
  | { ok: false; error: string };

export type TrialAccountResponse =
  | { ok: true }
  | { ok: false; error: string };

export type TrialAccountHandoffResult =
  | { destination: "/dashboard"; message: null; showSignIn: false }
  | { destination: null; message: string; showSignIn: boolean };

type TrialAccountHandoffDependencies = {
  createAccount: (
    payload: ReturnType<typeof trialAccountPayload>,
  ) => Promise<{
    status: number;
    ok: boolean;
    result: TrialAccountResponse;
  }>;
  signInWithPassword: (
    credentials: ReturnType<typeof trialPasswordCredentials>,
  ) => Promise<{
    data: {
      session: {
        user: { user_metadata: Record<string, unknown> };
      } | null;
    };
    error: unknown;
  }>;
};

export function trialIntakePayload(
  form: TrialSignupValues,
  attribution: AttributionSnapshot,
) {
  return {
    ownerName: form.ownerName,
    businessName: form.businessName,
    email: form.email,
    phone: form.phone,
    contactConsent: form.contactConsent,
    honeypot: form.honeypot,
    attribution,
  };
}

export function trialAccountPayload(
  form: TrialSignupValues,
  claim: TrialClaimResponse,
) {
  return {
    trialId: claim.trialId,
    claimToken: claim.claimToken,
    password: form.password,
  };
}

export function trialPasswordCredentials(form: TrialSignupValues) {
  return { email: form.email, password: form.password };
}

export async function completeTrialAccountHandoff(
  form: TrialSignupValues,
  claim: TrialClaimResponse,
  dependencies: TrialAccountHandoffDependencies,
): Promise<TrialAccountHandoffResult> {
  const account = await dependencies.createAccount(
    trialAccountPayload(form, claim),
  );
  const canAttemptSignIn = account.status === 409
    || (account.ok && account.result.ok);
  if (!canAttemptSignIn) {
    return {
      destination: null,
      message: account.result.ok
        ? "Couldn't create the account. Please try again."
        : account.result.error,
      showSignIn: false,
    };
  }

  const { data, error } = await dependencies.signInWithPassword(
    trialPasswordCredentials(form),
  );
  if (error || !data.session) {
    return {
      destination: null,
      message: "We couldn't sign in to continue this trial. Check the password and try again.",
      showSignIn: true,
    };
  }

  const metadata = data.session.user.user_metadata;
  if (
    metadata.acquisition_trial_id !== claim.trialId
    || metadata.acquisition_trial_token !== claim.claimToken
  ) {
    return {
      destination: null,
      message: "This account cannot continue the pending trial. Sign in with the matching account or restart with a different email.",
      showSignIn: true,
    };
  }

  return {
    destination: "/dashboard",
    message: null,
    showSignIn: false,
  };
}

export function validateTrialPassword(password: string) {
  return password.length < 8 ? "Use at least 8 characters for your password." : null;
}

export function trialSignupDestination(hasSession: boolean) {
  return hasSession ? "/dashboard" as const : null;
}

export function trialClaimNeedsRefresh(
  claim: TrialClaimResponse,
  now = Date.now(),
) {
  if (!claim.expiresAt) return false;
  const expiresAt = Date.parse(claim.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}
