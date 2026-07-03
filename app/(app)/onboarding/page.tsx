import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { presetForDialCode } from "@/lib/billing/money";
import { getOnboardingSnapshot } from "@/lib/dashboard/queries";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Get started — Nudge" };

/**
 * 3-step setup wizard (spec §M1). The dashboard redirects here when the org
 * has never onboarded AND has zero contacts; finishing or skipping sets
 * Org.onboardedAt so it never traps a working account.
 */
export default async function OnboardingPage() {
  const { org } = await requireOrgContext();
  if (org.onboardedAt) {
    redirect("/dashboard");
  }

  const snapshot = await getOnboardingSnapshot(org.id);

  return (
    <div className="mx-auto w-full max-w-2xl py-4">
      <OnboardingWizard
        orgName={org.name}
        vertical={org.vertical}
        country={presetForDialCode(org.dialCode)?.code ?? ""}
        whatsappConnected={snapshot.whatsappConnected}
        whatsappDisplayName={snapshot.whatsappDisplayName}
        simulationMode={snapshot.simulationMode}
        contactCount={snapshot.contactCount}
      />
    </div>
  );
}
