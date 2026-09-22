import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deriveTrialStatus, type TrialStatus } from "./state";

export type TrialKnowledgeSource = "website" | "gbp" | "file" | "interview";
export const TRIAL_FACT_LIMIT = 50;
export const TRIAL_WEB_IMPORT_LIMIT = 1;
export const TRIAL_FILE_IMPORT_LIMIT = 3;

export type TrialTourStep =
  | "welcome"
  | "train"
  | "test"
  | "inbox"
  | "locked"
  | "finish";

export interface TrialWorkspace {
  id: string;
  status: TrialStatus;
  emailVerified: boolean;
  expiresAt: string | null;
  repliesUsed: number;
  replyLimit: number;
  repliesRemaining: number;
  setupComplete: boolean;
  knowledgeSource: TrialKnowledgeSource | null;
  knowledgeReady: boolean;
  approvedFactCount: number;
  draftFactCount: number;
  factCount: number;
  factLimit: number;
  webImportsUsed: number;
  webImportLimit: number;
  fileImportsUsed: number;
  fileImportLimit: number;
  /** Temporary compatibility alias for approvedFactCount. */
  knowledgeCount: number;
  firstReplyAt: string | null;
  exploreViewed: boolean;
  tourStep: TrialTourStep;
  tourCompleted: boolean;
  tourDismissed: boolean;
  demoBooked: boolean;
  converted: boolean;
}

const TOUR_STEPS = new Set<TrialTourStep>([
  "welcome",
  "train",
  "test",
  "inbox",
  "locked",
  "finish",
]);
const KNOWLEDGE_SOURCES = new Set<TrialKnowledgeSource>([
  "website",
  "gbp",
  "file",
  "interview",
]);

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function tourStep(value: string): TrialTourStep {
  return TOUR_STEPS.has(value as TrialTourStep)
    ? (value as TrialTourStep)
    : "welcome";
}

function knowledgeSource(value: string | null): TrialKnowledgeSource | null {
  return value && KNOWLEDGE_SOURCES.has(value as TrialKnowledgeSource)
    ? (value as TrialKnowledgeSource)
    : null;
}

/** One tenant-scoped, UI-safe projection for every trial screen. */
async function loadTrialWorkspace(
  orgId: string,
  now: Date,
): Promise<TrialWorkspace | null> {
  const trial = await prisma.acquisitionTrial.findUnique({
    where: { orgId },
    select: {
      id: true,
      orgId: true,
      claimedAt: true,
      emailVerifiedAt: true,
      startedAt: true,
      expiresAt: true,
      repliesUsed: true,
      replyLimit: true,
      knowledgeSource: true,
      knowledgeWebImportsUsed: true,
      knowledgeFileImportsUsed: true,
      tourStep: true,
      tourCompletedAt: true,
      tourDismissedAt: true,
      firstReplyAt: true,
      exploreViewedAt: true,
      demoBookedAt: true,
      convertedAt: true,
      org: { select: { subscriptionStatus: true, onboardedAt: true } },
    },
  });
  if (!trial) return null;

  const factGroups = await prisma.knowledgeEntry.groupBy({
    by: ["status"],
    where: { orgId, status: { in: ["active", "draft"] } },
    _count: { _all: true },
  });
  const approvedFactCount =
    factGroups.find((group) => group.status === "active")?._count._all ?? 0;
  const draftFactCount =
    factGroups.find((group) => group.status === "draft")?._count._all ?? 0;
  const status = deriveTrialStatus(
    {
      orgId: trial.orgId,
      claimedAt: trial.claimedAt,
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      repliesUsed: trial.repliesUsed,
      replyLimit: trial.replyLimit,
      convertedAt: trial.convertedAt,
      subscriptionStatus: trial.org?.subscriptionStatus ?? "inactive",
    },
    now,
  );

  return {
    id: trial.id,
    status,
    emailVerified: Boolean(trial.emailVerifiedAt),
    expiresAt: iso(trial.expiresAt),
    repliesUsed: trial.repliesUsed,
    replyLimit: trial.replyLimit,
    repliesRemaining: Math.max(0, trial.replyLimit - trial.repliesUsed),
    setupComplete: Boolean(trial.org?.onboardedAt),
    knowledgeSource: knowledgeSource(trial.knowledgeSource),
    knowledgeReady: approvedFactCount > 0,
    approvedFactCount,
    draftFactCount,
    factCount: approvedFactCount + draftFactCount,
    factLimit: TRIAL_FACT_LIMIT,
    webImportsUsed: Math.max(0, trial.knowledgeWebImportsUsed),
    webImportLimit: TRIAL_WEB_IMPORT_LIMIT,
    fileImportsUsed: Math.max(0, trial.knowledgeFileImportsUsed),
    fileImportLimit: TRIAL_FILE_IMPORT_LIMIT,
    knowledgeCount: approvedFactCount,
    firstReplyAt: iso(trial.firstReplyAt),
    exploreViewed: Boolean(trial.exploreViewedAt),
    tourStep: tourStep(trial.tourStep),
    tourCompleted: Boolean(trial.tourCompletedAt),
    tourDismissed: Boolean(trial.tourDismissedAt),
    demoBooked: Boolean(trial.demoBookedAt),
    converted: status === "converted",
  };
}

const getRequestTrialWorkspace = cache((orgId: string) =>
  loadTrialWorkspace(orgId, new Date()),
);

export function getTrialWorkspace(
  orgId: string,
  now?: Date,
): Promise<TrialWorkspace | null> {
  return now
    ? loadTrialWorkspace(orgId, now)
    : getRequestTrialWorkspace(orgId);
}

export async function requireAcquisitionTrial(orgId: string, now?: Date) {
  const workspace = await getTrialWorkspace(orgId, now);
  if (!workspace || workspace.converted) notFound();
  return workspace;
}

export function dashboardRedirectFor(
  trial: TrialWorkspace | null,
  genericOnboardingRequired: boolean,
) {
  if (trial && !trial.converted) {
    return null;
  }
  return genericOnboardingRequired ? "/onboarding" : null;
}

export function onboardingRedirectFor(trial: TrialWorkspace | null) {
  return trial && !trial.converted ? "/trial/setup" : null;
}
