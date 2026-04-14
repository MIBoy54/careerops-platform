import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { goToSavedContacts, goToWeeklyReportHistory } from '../helpers/navigation.js';

test('Generated weekly report appears in Weekly Report History', async ({ page }) => {
  await login(page);
  await goToSavedContacts(page);

  const rows = page.locator('#contactsTable tbody tr');
  const validRows = [];
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const statusText = await row.locator('td:nth-child(4)').innerText();

    if (statusText.trim().toLowerCase() === 'applied') {
      validRows.push(row);
    }
  }

  expect(validRows.length).toBeGreaterThanOrEqual(4);

  for (let i = 0; i < 4; i++) {
    await validRows[i].locator('input[type="checkbox"]').evaluate((checkbox) => {
      checkbox.click();
    });
  }

  await expect(page.locator('#viewButton')).toBeEnabled();
  await page.locator('#viewButton').evaluate((button) => {
    button.click();
  });

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