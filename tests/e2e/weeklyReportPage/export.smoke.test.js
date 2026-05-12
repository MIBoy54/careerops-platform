import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("export selected report control is available", async ({ page }) => {
  await login(page);

<<<<<<< HEAD
  await page.locator('[data-target="weeklyReportHistorySection"]').click();

  const section = page.locator("#weeklyReportHistorySection");

  await expect(section).toHaveClass(/active-section/);

  const exportButton = section.getByRole("button", {
    name: "Export Selected Report"
  });
=======
  await page
    .getByRole("button", {
      name: "Weekly Report History"
    })
    .click();

  const exportButton =
    page.locator("#unemploymentExportBtn");
>>>>>>> qa

  await expect(exportButton).toBeVisible();

  await expect(exportButton).toBeDisabled();
});