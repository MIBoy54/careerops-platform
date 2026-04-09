import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { seedContacts } from '../helpers/data.js';
import { goToSavedContacts, goToWeeklyReportHistory } from '../helpers/navigation.js';

test('Generated weekly report appears in Weekly Report History', async ({ page }) => {
  await login(page);
  await seedContacts(page);
  await goToSavedContacts(page);

  const rows = page.locator('#contactsTable tbody tr');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThanOrEqual(4);

  for (let i = 0; i < 4; i++) {
    await rows.nth(i).locator('input[type="checkbox"]').evaluate((checkbox) => {
      checkbox.click();
    });
  }

  await expect(page.locator('#viewButton')).toBeEnabled({ timeout: 10000 });
  await page.click('#viewButton');
  await expect(page.locator('#detailViewerSection')).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.click('#generateReportBtn');
  await page.click('#closeWeeklyReportDetailBtn');

  await goToWeeklyReportHistory(page);

  const historyRows = page.locator('#weekly-report-history-table tbody tr');
  await expect(historyRows.first()).toBeVisible();
});