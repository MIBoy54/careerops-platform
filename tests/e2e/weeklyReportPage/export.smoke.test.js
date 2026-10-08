import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("export selected report control is available", async ({ page }) => {
  await login(page);

  await page
    .getByRole("button", { name: /weekly report history/i })
    .click();

  const section = page.locator("#weeklyReportHistorySection");

  await expect(section).toHaveClass(/active-section/);
  await expect(section).toBeVisible();

  const exportButton = section.getByRole("button", {
    name: /export selected report/i
  });

  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeDisabled();
});