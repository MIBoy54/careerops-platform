import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { seedContacts } from '../helpers/data.js';
import { goToSavedContacts } from '../helpers/navigation.js';

test('Detail Viewer end-to-end flow', async ({ page }) => {
  await login(page);
  await seedContacts(page);
  await goToSavedContacts(page);

  const checkboxes = page.locator('#contactsTable tbody input.select-checkbox');

  await expect.poll(async () => await checkboxes.count(), {
    timeout: 10000
  }).toBeGreaterThan(0);

  const checkboxCount = await checkboxes.count();
  const selectionCount = Math.min(4, checkboxCount);

  for (let i = 0; i < selectionCount; i++) {
    await checkboxes.nth(i).check();
  }

  await page.click('#viewButton');
  await expect(page.locator('#detailViewerSection')).toBeVisible();

  const cards = page.locator('#detailViewerSection .contact-card');
  await expect(cards).toHaveCount(selectionCount);

  await page.click('#closeWeeklyReportDetailBtn');
  await expect(page.locator('#savedContactsSection')).toBeVisible();
});