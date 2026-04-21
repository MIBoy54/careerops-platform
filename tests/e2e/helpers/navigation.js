import { expect } from '@playwright/test';

export async function goToSavedContacts(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const savedContactsTab = page.locator('[data-target="savedContactsSection"]');
  const mainMenuBtn = page.locator('#mainMenuBtn');

  if (!(await savedContactsTab.isVisible())) {
    if (await mainMenuBtn.isVisible()) {
      await mainMenuBtn.click();
    }
  }

  await expect(savedContactsTab).toBeVisible({ timeout: 10000 });
  await savedContactsTab.click();

  await expect(page.locator('#savedContactsSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToDetailViewer(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const detailViewerTab = page.locator('[data-target="detailViewerSection"]');
  const mainMenuBtn = page.locator('#mainMenuBtn');

  if (!(await detailViewerTab.isVisible())) {
    if (await mainMenuBtn.isVisible()) {
      await mainMenuBtn.click();
    }
  }

  await expect(detailViewerTab).toBeVisible({ timeout: 10000 });
  await detailViewerTab.click();

  await expect(page.locator('#detailViewerSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToWeeklyReportHistory(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const weeklyHistoryTab = page.locator('[data-target="weeklyReportHistorySection"]');
  const mainMenuBtn = page.locator('#mainMenuBtn');

  if (!(await weeklyHistoryTab.isVisible())) {
    if (await mainMenuBtn.isVisible()) {
      await mainMenuBtn.click();
    }
  }

  await expect(weeklyHistoryTab).toBeVisible({ timeout: 10000 });
  await weeklyHistoryTab.click();

  await expect(page.locator('#weeklyReportHistorySection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}