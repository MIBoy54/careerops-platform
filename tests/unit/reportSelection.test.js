import { describe, expect, it } from "vitest";

function canExport(selectedReportRange) {
  return Boolean(selectedReportRange?.start && selectedReportRange?.end);
}

describe("report selection", () => {
  it("does not allow export with no selected report", () => {
    expect(canExport(null)).toBe(false);
  });

  it("allows export when a report range is selected", () => {
    expect(canExport({
      start: "2026-05-03",
      end: "2026-05-10"
    })).toBe(true);
  });
});