import { redirect } from "next/navigation";
import { requireOrgContext } from "@/modules/orgs/auth";
import { presetForDialCode } from "@/modules/billing/money";
import { getOnboardingSnapshot } from "@/modules/dashboard/queries";
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
  // The org is auto-named "<email>'s shop" at signup — don't make the owner
  // delete that before typing their real business name.
  const isAutoName = org.name === "My shop" || org.name.endsWith("'s shop");

  return (
    <div className="mx-auto w-full max-w-2xl py-4">
      <OnboardingWizard
        orgName={isAutoName ? "" : org.name}
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
