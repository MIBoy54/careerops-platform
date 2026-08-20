import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("Generated weekly report appears in Weekly Report History", async ({ page }) => {
  await login(page);

  await page
    .getByRole("button", { name: /weekly report history/i })
    .click();

  const section = page.locator("#weeklyReportHistorySection");
  const table = section.locator("#weekly-report-history-table");

  await expect(section).toHaveClass(/active-section/);
  await expect(section).toBeVisible();
  await expect(section.locator("h2")).toContainText("Weekly Report History");
  await expect(table).toBeVisible();
});