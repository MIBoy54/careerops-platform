import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("selecting a report highlights the row and enables export", async ({ page }) => {
  await login(page);

  await page.locator('[data-target="weeklyReportHistorySection"]').click();

  const section = page.locator("#weeklyReportHistorySection");
  await expect(section).toHaveClass(/active-section/);

  const rows = section.locator("#weekly-report-history-table tbody tr");
  await expect(rows.first()).toBeVisible();

  const firstRadio = rows.first().locator('input[type="radio"]');
  await firstRadio.click();

  await expect(firstRadio).toBeChecked();
  await expect(rows.first()).toHaveClass(/selected-row/);

  await expect(
    section.getByRole("button", { name: "Export Selected Report" })
  ).toBeEnabled();
});