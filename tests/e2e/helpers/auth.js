import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('/');

  const authCheck = await page.request.get('/api/auth/me');

  if (authCheck.ok()) {
    await expect(page.locator('#logoutBtn')).toBeVisible({ timeout: 10000 });
    return;
  }

  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });

 await page.fill('#email', process.env.TEST_EMAIL || 'test@careerops.local');
 await page.fill('#password', process.env.TEST_PASSWORD || 'test-password');

  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
    page.click('button[type="submit"]')
  ]);

  console.log('LOGIN STATUS:', response.status());

  const body = await response.text().catch(() => "");
  console.log("LOGIN BODY:", body);

  if (![200, 302].includes(response.status())) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  // Wait for redirect properly
  await page.waitForURL('**/', { timeout: 10000 }).catch(() => {});
  await page.goto('/');

  // Strong assertion (better than just body)
  await expect(page.locator('#logoutBtn')).toBeVisible({ timeout: 10000 });
}