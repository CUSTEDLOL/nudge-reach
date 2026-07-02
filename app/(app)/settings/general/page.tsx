import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "../section-header";
import { GeneralForm } from "./general-form";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettingsPage() {
  const { org } = await requireOrgContext();

  const settings =
    typeof org.settings === "object" &&
    org.settings !== null &&
    !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const avgOrderValueInr =
    typeof settings.avgOrderValueInr === "number" &&
    settings.avgOrderValueInr > 0
      ? Math.round(settings.avgOrderValueInr)
      : 1499;

  return (
    <section>
      <SectionHeader
        title="General"
        description="Your workspace identity and business defaults."
      />
      <Card className="p-6">
        <GeneralForm
          initial={{
            name: org.name,
            vertical: org.vertical ?? "",
            avgOrderValueInr,
          }}
        />
      </Card>
    </section>
  );
}
