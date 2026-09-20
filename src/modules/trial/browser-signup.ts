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
};

export type TrialIntakeResponse =
  | { ok: true; claim: TrialClaimResponse }
  | { ok: false; error: string };

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

export function trialAuthCredentials(
  form: TrialSignupValues,
  origin: string,
  claim: TrialClaimResponse,
) {
  return {
    email: form.email,
    password: form.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/trial/setup`,
      data: {
        acquisition_trial_id: claim.trialId,
        acquisition_trial_token: claim.claimToken,
      },
    },
  };
}

export function validateTrialPassword(password: string) {
  return password.length < 8 ? "Use at least 8 characters for your password." : null;
}

export function trialSignupDestination(hasSession: boolean) {
  return hasSession ? "/trial/setup" : null;
}
