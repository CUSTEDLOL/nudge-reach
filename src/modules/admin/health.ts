export type HealthSeverity = "healthy" | "degraded" | "critical" | "unknown";

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  critical: 3,
};

/** Cron runs every few minutes: <=5m healthy, <=30m degraded, then critical. */
export function classifyHeartbeat(lastSeenAt: Date | null, now = new Date()): HealthSeverity {
  if (!lastSeenAt) return "unknown";
  const ageMinutes = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / 60_000);
  if (ageMinutes <= 5) return "healthy";
  if (ageMinutes <= 30) return "degraded";
  return "critical";
}

export function highestSeverity(severities: HealthSeverity[]): HealthSeverity {
  return severities.reduce<HealthSeverity>(
    (highest, current) =>
      SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest,
    "healthy"
  );
}

/** Keep cron detail numeric, finite, non-negative, and small enough for diagnostics. */
export function boundedCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.floor(value)));
}

export interface OpsSignals {
  heartbeat: HealthSeverity;
  staleQueued: number;
  failedMessages: number;
  deadCrmJobs: number;
  webhookFailures: number;
  stuckTemplates: number;
  costAlerts: number;
}

/** One founder-facing state from freshness plus explicit incident counts. */
export function deriveOpsSeverity(signals: OpsSignals): HealthSeverity {
  if (
    signals.heartbeat === "critical" ||
    signals.failedMessages > 0 ||
    signals.deadCrmJobs > 0
  ) {
    return "critical";
  }
  if (signals.heartbeat === "unknown") return "unknown";
  if (
    signals.heartbeat === "degraded" ||
    signals.staleQueued > 0 ||
    signals.webhookFailures > 0 ||
    signals.stuckTemplates > 0 ||
    signals.costAlerts > 0
  ) {
    return "degraded";
  }
  return "healthy";
}
