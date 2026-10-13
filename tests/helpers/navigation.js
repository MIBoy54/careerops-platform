import { expect } from "@playwright/test";
import { waitForAppReady } from "./readiness.js";

async function goToSection(page, sectionId) {
  await waitForAppReady(page);
  await page.locator(`[data-target="${sectionId}"]`).click();
  const section = page.locator(`#${sectionId}`);
  await expect(section).toHaveClass(/active-section/);
  await expect(section).toBeVisible();
}

export async function goToSavedContacts(page) {
  await goToSection(page, "savedContactsSection");
}

export async function goToDetailViewer(page) {
  await goToSection(page, "detailViewerSection");
}

export async function goToWeeklyReportHistory(page) {
  await goToSection(page, "weeklyReportHistorySection");
}
