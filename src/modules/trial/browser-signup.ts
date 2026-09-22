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
