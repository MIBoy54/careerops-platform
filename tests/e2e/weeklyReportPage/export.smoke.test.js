import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("export selected report control is available", async ({ page }) => {
  await login(page);

  await page
    .getByRole("button", {
      name: "Weekly Report History"
    })
    .click();

  const exportButton =
    page.locator("#unemploymentExportBtn");

  await expect(exportButton).toBeVisible();

  await expect(exportButton).toBeDisabled();
});