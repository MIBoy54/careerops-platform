import { describe, expect, it } from "vitest";

function buildExportUrl(start, end) {
  return `/api/reports/unemployment/export?start=${start}&end=${end}`;
}

describe("buildExportUrl", () => {
  it("builds the unemployment export URL for a selected report", () => {
    expect(buildExportUrl("2026-05-03", "2026-05-10"))
      .toBe("/api/reports/unemployment/export?start=2026-05-03&end=2026-05-10");
  });
});