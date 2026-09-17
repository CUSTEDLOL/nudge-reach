export interface LeadLeakageInputs {
  monthlyLeads: number;
  missedReplyPercent: number;
  missingFollowupPercent: number;
  conversionPercent: number;
  averageSaleValue: number;
}

export interface LeadLeakageResult {
  missedReplyLeads: number;
  repliedLeads: number;
  missingFollowupLeads: number;
  leadsAtRisk: number;
  customersAtRisk: number;
  monthlyRevenueAtRisk: number;
  annualRevenueAtRisk: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function nonNegative(value: number): number {
  return Math.max(0, finiteOrZero(value));
}

function percentage(value: number): number {
  return Math.min(100, nonNegative(value));
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeLeadLeakageInputs(
  inputs: LeadLeakageInputs,
): LeadLeakageInputs {
  return {
    monthlyLeads: nonNegative(inputs.monthlyLeads),
    missedReplyPercent: percentage(inputs.missedReplyPercent),
    missingFollowupPercent: percentage(inputs.missingFollowupPercent),
    conversionPercent: percentage(inputs.conversionPercent),
    averageSaleValue: nonNegative(inputs.averageSaleValue),
  };
}

export function calculateLeadLeakage(
  inputs: LeadLeakageInputs,
): LeadLeakageResult {
  const normalized = normalizeLeadLeakageInputs(inputs);
  const missedReplyLeads =
    (normalized.monthlyLeads * normalized.missedReplyPercent) / 100;
  const repliedLeads = normalized.monthlyLeads - missedReplyLeads;
  const missingFollowupLeads =
    (repliedLeads * normalized.missingFollowupPercent) / 100;
  const leadsAtRisk = missedReplyLeads + missingFollowupLeads;
  const customersAtRisk =
    (leadsAtRisk * normalized.conversionPercent) / 100;
  const monthlyRevenueAtRisk =
    customersAtRisk * normalized.averageSaleValue;
  const annualRevenueAtRisk = monthlyRevenueAtRisk * 12;

  return {
    missedReplyLeads: roundToTwoDecimals(missedReplyLeads),
    repliedLeads: roundToTwoDecimals(repliedLeads),
    missingFollowupLeads: roundToTwoDecimals(missingFollowupLeads),
    leadsAtRisk: roundToTwoDecimals(leadsAtRisk),
    customersAtRisk: roundToTwoDecimals(customersAtRisk),
    monthlyRevenueAtRisk: Math.round(monthlyRevenueAtRisk),
    annualRevenueAtRisk: Math.round(annualRevenueAtRisk),
  };
}
