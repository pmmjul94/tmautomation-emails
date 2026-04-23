// Supported industries → Zoho CRM custom-field values.
// Edit the right-hand side to match the exact picklist values in your CRM.

export const INDUSTRIES = {
  restaurants: "Restaurant",
  "health-fitness": "Health & Fitness",
  "non-profit": "Nonprofit",
  "retail-ecomm": "Retail",
} as const;

export type IndustryKey = keyof typeof INDUSTRIES;

export const INDUSTRY_KEYS = Object.keys(INDUSTRIES) as IndustryKey[];

export function toZohoIndustry(key: string): string | null {
  return (INDUSTRIES as Record<string, string>)[key] ?? null;
}

export function industryLabel(key: string): string {
  return (INDUSTRIES as Record<string, string>)[key] ?? key;
}
