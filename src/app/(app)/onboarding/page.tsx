import { redirect } from "next/navigation";
import { requireOrgContext } from "@/modules/orgs/auth";
import { presetForDialCode } from "@/modules/billing/money";
import { getOnboardingSnapshot } from "@/modules/dashboard/queries";
import {
  parseUiPreferences,
  parseWorkspaceProfile,
} from "@/modules/dashboard/workspace-profile";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Get started — Nudge" };

/** First-run discovery and setup. The dashboard redirects here only for a new,
 * empty org; completed owners can return with ?customize=1. */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ customize?: string }>;
}) {
  const [{ org, membership }, params] = await Promise.all([
    requireOrgContext(),
    searchParams,
  ]);
  const customizing = params.customize === "1";
  if (org.onboardedAt && !customizing) {
    redirect("/dashboard");
  }

  const snapshot = await getOnboardingSnapshot(org.id);
  // The org is auto-named "<email>'s shop" at signup — don't make the owner
  // delete that before typing their real business name.
  const isAutoName = org.name === "My shop" || org.name.endsWith("'s shop");

  return (
    <OnboardingWizard
      orgName={isAutoName ? "" : org.name}
      vertical={org.vertical}
      country={presetForDialCode(org.dialCode)?.code ?? ""}
      whatsappConnected={snapshot.whatsappConnected}
      whatsappDisplayName={snapshot.whatsappDisplayName}
      simulationMode={snapshot.simulationMode}
      contactCount={snapshot.contactCount}
      initialProfile={parseWorkspaceProfile(org.settings)}
      initialUiPreferences={parseUiPreferences(membership.uiPreferences)}
      customizing={customizing}
    />
  );
}
