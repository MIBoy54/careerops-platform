import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { goToSavedContacts } from '../helpers/navigation.js';

test('Detail Viewer end-to-end flow', async ({ page }) => {
  await login(page);
  await goToSavedContacts(page);

  const checkboxes = page.locator('#contactsTable tbody input.select-checkbox');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();
  await checkboxes.nth(3).check();

  await page.click('#viewButton');
  await expect(page.locator('#detailViewerSection')).toBeVisible();

  const cards = page.locator('#weekly-report-detail .contact-card');
  await expect(cards).toHaveCount(4);

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.click('#generateReportBtn');
  await page.click('#closeWeeklyReportDetailBtn');

  await expect(page.locator('#savedContactsSection')).toBeVisible();
});