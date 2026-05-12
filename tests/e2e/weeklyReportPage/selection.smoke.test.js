import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

<<<<<<< HEAD
test("selecting a report highlights the row and enables export", async ({ page }) => {
  await login(page);

  await page.locator('[data-target="weeklyReportHistorySection"]').click();

  const section = page.locator("#weeklyReportHistorySection");
  await expect(section).toHaveClass(/active-section/);

  const rows = section.locator("#weekly-report-history-table tbody tr");
  const rowCount = await rows.count();

  if (rowCount === 0) {
    test.skip(true, "No weekly reports available in this environment.");
  }

  const firstRow = rows.first();
  await expect(firstRow).toBeVisible();

  const firstRadio = firstRow.locator('input[type="radio"]');
  await firstRadio.click();

  await expect(firstRadio).toBeChecked();
  await expect(firstRow).toHaveClass(/selected-row/);

  await expect(
    section.getByRole("button", { name: "Export Selected Report" })
  ).toBeEnabled();
=======
test("views selected contacts in detail viewer", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Saved Contacts" }).click();

  const checkboxes = page.locator(".select-checkbox");

  await expect(checkboxes.first()).toBeVisible();

  for (let i = 0; i < 4; i++) {
    await checkboxes.nth(i).check();
  }

  await page.getByRole("button", { name: "View Selected" }).click();

  await expect(page.locator("#detailViewerSection")).toHaveClass(/active-section/);

  await expect(
    page.getByRole("heading", { name: "Selected Employer Details" })
  ).toBeVisible();

  await expect(page.locator(".contact-card")).toHaveCount(4);
>>>>>>> qa
});