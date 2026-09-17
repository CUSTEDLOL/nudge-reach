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
  /**
   * True when JavaScript's numeric range forced one or more estimates to be
   * capped. UIs must disclose that capped results are limits, not exact values.
   */
  calculationCapped: boolean;
}

interface FiniteArithmeticResult {
  value: number;
  capped: boolean;
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

function multiplyFinite(left: number, right: number): FiniteArithmeticResult {
  if (left === 0 || right === 0) return { value: 0, capped: false };
  return left > Number.MAX_VALUE / right
    ? { value: Number.MAX_VALUE, capped: true }
    : { value: left * right, capped: false };
}

function addFinite(left: number, right: number): FiniteArithmeticResult {
  return left > Number.MAX_VALUE - right
    ? { value: Number.MAX_VALUE, capped: true }
    : { value: left + right, capped: false };
}

function roundToTwoDecimals(value: number): number {
  const scale = 100;
  if (value > Number.MAX_SAFE_INTEGER / scale) return Math.round(value);
  const scaled = value * scale;
  const relativeTolerance = Number.EPSILON * Math.abs(scaled);
  return Math.round(scaled + relativeTolerance) / scale;
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
    normalized.monthlyLeads * (normalized.missedReplyPercent / 100);
  const repliedLeads = normalized.monthlyLeads - missedReplyLeads;
  const missingFollowupLeads =
    repliedLeads * (normalized.missingFollowupPercent / 100);
  const leadsAtRiskResult = addFinite(
    missedReplyLeads,
    missingFollowupLeads,
  );
  const leadsAtRisk = leadsAtRiskResult.value;
  const customersAtRisk =
    leadsAtRisk * (normalized.conversionPercent / 100);
  const monthlyRevenueAtRiskResult = multiplyFinite(
    customersAtRisk,
    normalized.averageSaleValue,
  );
  const annualRevenueAtRiskResult = multiplyFinite(
    monthlyRevenueAtRiskResult.value,
    12,
  );

  return {
    missedReplyLeads: roundToTwoDecimals(missedReplyLeads),
    repliedLeads: roundToTwoDecimals(repliedLeads),
    missingFollowupLeads: roundToTwoDecimals(missingFollowupLeads),
    leadsAtRisk: roundToTwoDecimals(leadsAtRisk),
    customersAtRisk: roundToTwoDecimals(customersAtRisk),
    monthlyRevenueAtRisk: Math.round(monthlyRevenueAtRiskResult.value),
    annualRevenueAtRisk: Math.round(annualRevenueAtRiskResult.value),
    calculationCapped:
      leadsAtRiskResult.capped ||
      monthlyRevenueAtRiskResult.capped ||
      annualRevenueAtRiskResult.capped,
  };
}
