import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("export remains disabled until a report is selected", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Weekly Report History" }).click();

  const section = page.locator("#weeklyReportHistorySection");

  await expect(section).toHaveClass(/active-section/);

  const exportButton = section.getByRole("button", {
    name: "Export Selected Report"
  });

  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeDisabled();
});