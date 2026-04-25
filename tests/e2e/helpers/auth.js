import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('/');

  const authCheck = await page.request.get('/api/auth/me');

  if (authCheck.ok()) {
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    return;
  }

  await page.goto('/login.html');

  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  await page.fill('#email', 'b.r.lewis@outlook.com');
  await page.fill('#password', '27@67Hampden!');

  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
    page.click('button[type="submit"]')
  ]);

  console.log('LOGIN STATUS:', response.status());

  if (![200, 302].includes(response.status())) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  await page.goto('/');
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
}