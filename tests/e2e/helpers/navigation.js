import { expect } from '@playwright/test';

export async function goToSavedContacts(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  await page.locator('[data-target="savedContactsSection"]').click();

  await expect(page.locator('#savedContactsSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToDetailViewer(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  await page.locator('[data-target="detailViewerSection"]').click();

  await expect(page.locator('#detailViewerSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}