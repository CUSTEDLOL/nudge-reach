import { prisma } from "@/lib/db";
import type { Plan } from "@/modules/billing/plans";

export const ACQUISITION_TRIAL_PLAN: Plan = {
  id: "free",
  name: "Free trial",
  tagline: "A safe test workspace with 15 AI replies.",
  features: ["Business knowledge", "Simulated customer conversations"],
  includedCredits: 0,
  legacy: true,
  limits: {
    contacts: 1,
    teamMembers: 1,
    automations: 0,
    messagesPerMonth: 0,
    whatsappNumbers: 0,
    aiFrontDesk: false,
    publicApi: false,
    customActions: false,
    byoLlm: false,
    multiNumber: false,
    webWidget: false,
    leadScoring: false,
    voiceAgent: false,
    voiceMinutesPerMonth: 0,
  },
};

export async function isRestrictedAcquisitionTrial(orgId: string) {
  const row = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    select: {
      convertedAt: true,
      org: { select: { subscriptionStatus: true } },
    },
  });
  return Boolean(
    row && !row.convertedAt && row.org?.subscriptionStatus !== "active"
  );
}
