import { expect } from '@playwright/test';

export async function goToLandingPage(page) {
  await expect(page.getByText('CareerOps Landing Page')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#landingPage')).toBeVisible({ timeout: 10000 });
}

export async function goToSavedContacts(page) {
  await goToLandingPage(page);

  const savedContactsBtn = page.locator('#landingPage button[data-target="savedContactsSection"]');
  await expect(savedContactsBtn).toBeVisible({ timeout: 10000 });
  await savedContactsBtn.click();

  await expect(page.locator('#savedContactsSection')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#contactsTable')).toBeVisible({ timeout: 10000 });
}

export async function goToDetailViewer(page) {
  const detailViewerBtn = page.locator('button[data-target="detailViewerSection"]');
  await expect(detailViewerBtn).toBeVisible({ timeout: 10000 });
  await detailViewerBtn.click();

  await expect(page.locator('#detailViewerSection')).toBeVisible({ timeout: 10000 });
}
    export async function goToWeeklyReportHistory(page) {
        await page.locator('button[data-target="weeklyReportHistorySection"]').evaluate((button) => {
            button.click();
        });

        await expect(page.locator('#weeklyReportHistorySection')).toBeVisible({ timeout: 10000 });
    }
