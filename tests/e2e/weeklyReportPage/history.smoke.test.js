import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("Generated weekly report appears in Weekly Report History", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Weekly Report History" }).click();

await page
  .getByRole("button", {
    name: "Weekly Report History"
  })
  .click();

const section = page.locator("#weeklyReportHistorySection");

await expect(section).toHaveClass(/active-section/);

  await expect(
    section.locator("h2")
  ).toContainText("Weekly Report History");

  await expect(section).toHaveClass(/active-section/);

  await expect(
    section.locator("#weekly-report-history-table")
  ).toBeVisible();

  const rows = section.locator("#weekly-report-history-table tbody tr");

  await expect(rows.first()).toBeVisible();

  await expect(
    rows.first().locator('input[type="radio"]')
  ).toBeVisible();

  await expect(
    rows.first().getByRole("button", { name: "View" })
  ).toBeVisible();
});