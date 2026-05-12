import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("export selected report control is available", async ({ page }) => {
  await login(page);

  await page
  .getByRole("button", {
    name: /weekly report history/i
  })
  .click();

  await page.waitForTimeout(500)

  const section = page.locator("#weeklyReportHistorySection");

  await expect.poll(async () => {
  return await section.getAttribute("class");
  }, {
    timeout: 10000
  }).toContain("active-section");

    const exportButton = section.getByRole("button", {
      name: "Export Selected Report"
    });

  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeDisabled();
});