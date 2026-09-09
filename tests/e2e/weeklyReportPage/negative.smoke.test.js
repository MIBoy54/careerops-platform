import { expect, test } from "@playwright/test";

import { login } from "../helpers/auth";

test("export remains disabled until a report is selected", async ({ page }) => {
  await login(page);

  const historyNav = page.locator(
    '[data-target="weeklyReportHistorySection"]'
  );

  await expect(historyNav).toBeVisible();

  // Let initial application startup/navigation settle.
  await page.waitForLoadState("networkidle");

  await historyNav.click();

  const section = page.locator("#weeklyReportHistorySection");

  await expect(section).toHaveClass(/active-section/, {
    timeout: 10000
  });

  const exportButton = section.getByRole("button", {
    name: "Export Selected Report"
  });

  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeDisabled();
});