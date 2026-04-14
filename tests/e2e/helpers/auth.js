import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('/login.html');

  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  await page.fill('#email', 'b.r.lewis@outlook.com');
  await page.fill('#password', '27@67Hampden');

  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/$/);

  // Start the app fresh after session is established
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
}