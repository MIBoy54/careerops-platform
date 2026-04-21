import { expect } from '@playwright/test';

export async function goToSavedContacts(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const mainMenuBtn = page.locator('#mainMenuBtn');

  if (await mainMenuBtn.isVisible()) {
    await mainMenuBtn.click();
  }

  await page.evaluate(() => {
    const btn = document.querySelector('[data-target="savedContactsSection"]');
    if (!btn) {
      throw new Error('Saved Contacts tab not found');
    }
    btn.click();
  });

  await expect(page.locator('#savedContactsSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToDetailViewer(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const mainMenuBtn = page.locator('#mainMenuBtn');

  if (await mainMenuBtn.isVisible()) {
    await mainMenuBtn.click();
  }

  await page.evaluate(() => {
    const btn = document.querySelector('[data-target="detailViewerSection"]');
    if (!btn) {
      throw new Error('Detail Viewer tab not found');
    }
    btn.click();
  });

  await expect(page.locator('#detailViewerSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToWeeklyReportHistory(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const mainMenuBtn = page.locator('#mainMenuBtn');

  if (await mainMenuBtn.isVisible()) {
    await mainMenuBtn.click();
  }

  await page.evaluate(() => {
    const btn = document.querySelector('[data-target="weeklyReportHistorySection"]');
    if (!btn) {
      throw new Error('Weekly Report History tab not found');
    }
    btn.click();
  });

  await expect(page.locator('#weeklyReportHistorySection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}