import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { seedContacts } from '../helpers/data.js';
import { goToSavedContacts } from '../helpers/navigation.js';

test('Detail Viewer end-to-end flow', async ({ page }) => {
  page.on('console', (msg) => {
    console.log('BROWSER LOG:', msg.text());
  });

  page.on('pageerror', (err) => {
    console.log('PAGE ERROR:', err.message);
  });

  await login(page);
  await seedContacts(page);

  const apiContacts = await page.evaluate(async () => {
    const response = await fetch('/api/contacts');
    return await response.json();
  });

  console.log('API contacts after seed:', apiContacts);
  expect(apiContacts.length).toBeGreaterThan(0);

  await page.reload();
  await goToSavedContacts(page);

  await expect(
    page.locator("#contactsTable tbody tr").first()
  ).toBeVisible();

  const contactRows = page.locator('#contactsTable tbody tr');

  await expect.poll(async () => {
    const rowCount = await contactRows.count();
    console.log('Saved Contacts row count:', rowCount);
    return rowCount;
  }, {
    timeout: 10000
  }).toBeGreaterThan(0);

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
  await expect(page.locator('#detailViewerSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });

  const cards = page.locator('#detailViewerSection .contact-card');
  await expect(cards).toHaveCount(selectionCount);

    await expect(
  page.locator('#closeWeeklyReportDetailBtn')
  ).toBeVisible();

await page.click('#closeWeeklyReportDetailBtn');

await expect(
  page.locator('#detailViewerSection')
).toHaveClass(/active-section/, {
  timeout: 10000
});
});

