import { describe, expect, it } from "vitest";
import { validateWeeklyReport } from "../src/validateWeeklyReport.js";

describe("Weekly Report Validation", () => {
  it("fails when no job contacts exist", () => {
    const report = {
      week_start: "2026-03-08",
      week_end: "2026-03-14",
      job_contacts: []
    };

    expect(validateWeeklyReport(report)).toBe(false);
  });

  it("passes when job contacts exist", () => {
    const report = {
      week_start: "2026-03-08",
      week_end: "2026-03-14",
      job_contacts: [{ id: 1 }]
    };

    expect(validateWeeklyReport(report)).toBe(true);
  });
});