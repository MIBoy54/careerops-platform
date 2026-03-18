import { describe, expect, it } from "vitest";
import { validateWeeklyReport } from "../src/validateWeeklyReport.js";

describe("Weekly Report Validation", () => {
  it("fails when no job contacts exist", () => {
    const report = {
      week_start: "2026-03-08",
      week_end: "2026-03-14",
      job_contacts: []
    };

    const result = validateWeeklyReport(report);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one job contact is required.");
  });

  it("passes when job contacts exist", () => {
    const report = {
      week_start: "2026-03-08",
      week_end: "2026-03-14",
      job_contacts: [{ id: 1 }]
    };

    const result = validateWeeklyReport(report);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when week end is before week start", () => {
    const report = {
      week_start: "2026-03-10",
      week_end: "2026-03-01",
      job_contacts: [{ id: 1 }]
    };

    const result = validateWeeklyReport(report);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Week end date cannot be before week start date.");
  });

  it("fails when reporting window is greater than 7 days", () => {
    const report = {
      week_start: "2026-03-01",
      week_end: "2026-03-28",
      job_contacts: [{ id: 1 }]
    };

    const result = validateWeeklyReport(report);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Reporting window must be 7 days or less.");
  });
});