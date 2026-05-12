import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("generating a weekly report enables export history flow", async ({ page }) => {
  await login(page);

  // Go to Saved Contacts
  await page
    .getByRole("button", {
      name: /saved contacts/i
    })
    .click();

  const rows = page.locator("#contactsTable tbody tr");

  await expect(rows.first()).toBeVisible();

  const checkboxes = page.locator(
    '#contactsTable tbody input.select-checkbox'
  );

  // Select 4 contacts
  for (let i = 0; i < 4; i++) {
    await checkboxes.nth(i).check();
  }

  // View Selected
  await page
    .getByRole("button", {
      name: /view selected/i
    })
    .click();

  // Detail Viewer opens
  await expect(
    page.locator("#detailViewerSection")
  ).toHaveClass(/active-section/);

  // Generate Weekly Report
  page.on("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "This will mark selected companies as reported"
    );

    await dialog.accept();
  });

  await page
    .getByRole("button", {
      name: /generate weekly report/i
    })
    .click();

  // Navigate to Weekly Report History
  await page
    .getByRole("button", {
      name: /weekly report history/i
    })
    .click();

  const historySection = page.locator(
    "#weeklyReportHistorySection"
  );

  await expect(historySection).toHaveClass(/active-section/);

  // Verify reports exist
  const historyRows = historySection.locator(
    "#weekly-report-history-table tbody tr"
  );

  await expect(historyRows.first()).toBeVisible();
});