/**
 * Business verticals offered during onboarding. Shared by the wizard UI
 * (client) and its server action, so the allowlist can't drift.
 */
export const VERTICALS = [
  { value: "boutique", label: "Boutique / Clothing" },
  { value: "jewellery", label: "Jewellery" },
  { value: "electronics", label: "Electronics / Mobile" },
  { value: "grocery", label: "Grocery / Kirana" },
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "salon", label: "Salon / Beauty" },
  { value: "clinic", label: "Clinic / Health" },
  { value: "home_decor", label: "Home & Decor" },
  { value: "real_estate", label: "Real estate" },
  { value: "services", label: "Local services" },
  { value: "other", label: "Something else" },
] as const;

export type VerticalValue = (typeof VERTICALS)[number]["value"];

export function isVertical(value: string): value is VerticalValue {
  return VERTICALS.some((v) => v.value === value);
}
