import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('/');

  // Demo-mode / bypass-auth path
  if (!page.url().includes('/login.html')) {
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    return;
  }

  // Real login path
  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  await page.fill('#email', 'b.r.lewis@outlook.com');
  await page.fill('#password', 'YOUR_PASSWORD_HERE');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/$/);
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
}