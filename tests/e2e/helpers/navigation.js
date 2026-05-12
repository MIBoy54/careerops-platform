import { expect } from '@playwright/test';

export async function goToSavedContacts(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const mainMenuBtn = page.locator('#mainMenuBtn');
  const savedContactsTab = page.locator('[data-target="savedContactsSection"]').first();

  if (await mainMenuBtn.isVisible()) {
    await mainMenuBtn.click();
  }

  await expect(savedContactsTab).toBeVisible({ timeout: 10000 });
  await savedContactsTab.click();

  await page.evaluate(() => {
    document.querySelectorAll('.careerops-section').forEach((section) => {
      section.classList.remove('active-section');
    });

    const target = document.getElementById('savedContactsSection');
    if (!target) throw new Error('savedContactsSection not found');

    target.classList.add('active-section');
  });

  await expect(page.locator('#savedContactsSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToDetailViewer(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const mainMenuBtn = page.locator('#mainMenuBtn');
  const detailViewerTab = page.locator('[data-target="detailViewerSection"]').first();

  if (await mainMenuBtn.isVisible()) {
    await mainMenuBtn.click();
  }

  await expect(detailViewerTab).toBeVisible({ timeout: 10000 });
  await detailViewerTab.click();

  await page.evaluate(() => {
    document.querySelectorAll('.careerops-section').forEach((section) => {
      section.classList.remove('active-section');
    });

    const target = document.getElementById('detailViewerSection');
    if (!target) throw new Error('detailViewerSection not found');

    target.classList.add('active-section');
  });

  await expect(page.locator('#detailViewerSection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}

export async function goToWeeklyReportHistory(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

  const mainMenuBtn = page.locator('#mainMenuBtn');
  const weeklyReportHistoryTab = page
    .locator('[data-target="weeklyReportHistorySection"]')
    .first();

  if (await mainMenuBtn.isVisible()) {
    await mainMenuBtn.click();
  }

  await expect(weeklyReportHistoryTab).toBeVisible({ timeout: 10000 });
  await weeklyReportHistoryTab.click();

  await page.evaluate(() => {
    document.querySelectorAll('.careerops-section').forEach((section) => {
      section.classList.remove('active-section');
    });

    const target = document.getElementById('weeklyReportHistorySection');
    if (!target) throw new Error('weeklyReportHistorySection not found');

    target.classList.add('active-section');
  });

  await expect(page.locator('#weeklyReportHistorySection')).toHaveClass(/active-section/, {
    timeout: 10000
  });
}