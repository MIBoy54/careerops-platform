import { expect } from '@playwright/test';

async function showSection(page, sectionId) {
  await page.evaluate((targetId) => {
    document.querySelectorAll('.careerops-section').forEach((section) => {
      section.classList.remove('active-section');
    });

    const target = document.getElementById(targetId);
    if (target) {
      target.classList.add('active-section');
    }
  }, sectionId);
}

export async function goToLandingPage(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  await showSection(page, 'landingPage');
  await expect(page.locator('#landingPage')).toBeVisible({ timeout: 10000 });
}

export async function goToSavedContacts(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  await showSection(page, 'savedContactsSection');
  await expect(page.locator('#savedContactsSection')).toBeVisible({ timeout: 10000 });
}

export async function goToDetailViewer(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  await showSection(page, 'detailViewerSection');
  await expect(page.locator('#detailViewerSection')).toBeVisible({ timeout: 10000 });
}

export async function goToWeeklyReportHistory(page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  await showSection(page, 'weeklyReportHistorySection');
  await expect(page.locator('#weeklyReportHistorySection')).toBeVisible({ timeout: 10000 });
}