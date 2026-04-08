import { expect, test } from '@playwright/test';

test('Detail Viewer end-to-end flow', async ({ page }) => {

  // --- Login ---
  await page.goto('http://localhost:3000/login.html');

  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('StrongPass123');

  await Promise.all([
    page.waitForNavigation(),
    page.getByRole('button', { name: 'Login' }).click()
  ]);

  // --- Verify landing ---
  await expect(page.getByText('CareerOps Landing Page')).toBeVisible();

  // --- Navigate to Saved Contacts ---
  await page.getByRole('button', { name: 'Saved Contacts' }).click();

  await expect(page.locator('#savedContactsSection')).toBeVisible();

  // --- Select 4 contacts ---
  const checkboxes = page.locator('input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();
  await checkboxes.nth(3).check();

  // --- View Selected ---
  await page.click('#viewButton');

  await expect(page.locator('#detailViewerSection')).toBeVisible();

  // --- Validate cards ---
  const cards = page.locator('#weekly-report-detail .contact-card');
  await expect(cards).toHaveCount(4);

  // --- Generate Report ---
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.click('#generateReportBtn');

  // --- Close ---
  await page.click('#closeWeeklyReportDetailBtn');

  // --- Back to Saved Contacts ---
  await expect(page.locator('#savedContactsSection')).toBeVisible();
});
test('View Selected is disabled when no contacts are selected', async ({ page }) => {
  await page.goto('http://localhost:3000/login.html');

  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('StrongPass123');

  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('CareerOps Landing Page')).toBeVisible();

  await page.getByRole('button', { name: 'Saved Contacts' }).click();
  await expect(page.locator('#viewButton')).toBeDisabled();
});