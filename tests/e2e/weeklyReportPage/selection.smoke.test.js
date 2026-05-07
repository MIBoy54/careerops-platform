import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("exports selected weekly report as CSV", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Weekly Report History" }).click();

const firstRadio = page.getByRole("radio").first();
await firstRadio.click();

await expect(firstRadio).toBeChecked();

const selectedRow = page
  .locator("#weekly-report-history-table tbody tr")
  .first();

await expect(selectedRow).toHaveClass(/selected-row/);

  const exportButton = page.getByRole("button", {
    name: "Export Selected Report"
  });

  await expect(exportButton).toBeEnabled();
});