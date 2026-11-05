import { describe, it, expect } from "vitest";
import { normalizeIndustryPatch, summarizeIndustries } from "../../src/contactIndustry.js";

describe("contact industry", () => {
  it("preserves an omitted industry and distinguishes an explicit clear", () => {
    expect(normalizeIndustryPatch({}).values).toEqual({});
    expect(normalizeIndustryPatch({ industry: "  " }).values).toEqual({ industry: null });
    expect(normalizeIndustryPatch({ industry: null }).values).toEqual({ industry: null });
  });
  it("trims industry text while allowing custom classifications", () => {
    expect(normalizeIndustryPatch({ industry: "  Aerospace Research  " }).values)
      .toEqual({ industry: "Aerospace Research" });
  });
  it.each([123, {}, [], "x".repeat(101)])("rejects invalid industry: %j", industry => {
    expect(normalizeIndustryPatch({ industry }).valid).toBe(false);
  });
  it("counts every contact once and reconciles legacy labels", () => {
    const contacts = ["Healthcare", " healthcare ", "Financial", "Financial Services",
      "SaaS", "Software", null, "", " Other ", "UNKNOWN", "not reported", "Aerospace Research", "aerospace research"]
      .map(industry => ({ industry }));
    const rows = summarizeIndustries(contacts);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(contacts.length);
    expect(rows).toEqual([
      { industry: "Aerospace Research", count: 2 },
      { industry: "Financial Services", count: 2 },
      { industry: "Healthcare", count: 2 },
      { industry: "Not Reported", count: 5 },
      { industry: "Software", count: 2 }
    ]);
  });
});

