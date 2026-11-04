export const INDUSTRIES = [
  "Healthcare", "Financial Services", "Software", "IT Services & Consulting",
  "Staffing & Recruiting", "Insurance", "Government", "Government Contracting",
  "Cybersecurity", "Professional Services", "Manufacturing", "Education",
  "Telecommunications", "Hospitality & Travel", "Transportation & Logistics",
  "Media & Entertainment", "Real Estate & Construction", "Nonprofit",
  "Biotechnology", "Retail & E-commerce", "Energy & Utilities", "Consumer Goods",
  "Food & Beverage", "Business Process Outsourcing", "Other"
];

export function normalizeIndustryPatch(body = {}) {
  if (!Object.hasOwn(body, "industry")) return { valid: true, values: {} };
  if (body.industry !== null && typeof body.industry !== "string") {
    return { valid: false, error: "Industry must be text." };
  }
  const industry = body.industry?.trim() || null;
  if (industry && industry.length > 100) {
    return { valid: false, error: "Industry must be 100 characters or fewer." };
  }
  return { valid: true, values: { industry } };
}

export function summarizeIndustries(contacts) {
  const labels = new Map(INDUSTRIES.map(label => [label.toLowerCase(), label]));
  labels.set("financial", "Financial Services");
  labels.set("saas", "Software");
  labels.set("unknown", "Unknown");
  const counts = new Map();
  for (const contact of contacts) {
    const value = String(contact.industry || "").trim();
    const key = value.toLowerCase() || "unknown";
    const label = labels.get(key) || value;
    const normalized = label.toLowerCase();
    const entry = counts.get(normalized) || { industry: label, count: 0 };
    entry.count++;
    counts.set(normalized, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry));
}
