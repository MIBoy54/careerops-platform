import { test, expect } from '@playwright/test';
import { login } from '../../helpers/auth.js';

for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
  test(`DEMO guest login is passwordless at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/version', route => route.fulfill({json:{environment:'demo'}}));
    let passwordLoginCalls=0;
    page.on('request', request => { if(request.url().endsWith('/api/auth/login')) passwordLoginCalls++; });
    await page.route('**/api/auth/me', route => route.fulfill({json:{app_env:'demo',user:{role:'guest'}}}));
    await page.goto('/login.html');
    await expect(page.locator('#guestLogin')).toBeVisible();
    await expect(page.locator('#email')).toBeHidden();
    await expect(page.locator('#password')).toBeHidden();
    await page.locator('#guestLogin').click();
    await expect(page).toHaveURL(/\/$/);
    expect(passwordLoginCalls).toBe(0);
  });
}
test('QA login remains ordinary even on a demo-like URL', async ({ page }) => {
  await page.route('**/version', route => route.fulfill({json:{environment:'qa'}}));
  await page.goto('/login.html');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#guestLogin')).toBeHidden();
});
test('guest-session refusal shows a retryable accessible error', async ({ page }) => {
  await page.route('**/version', route => route.fulfill({json:{environment:'demo'}}));
  await page.route('**/api/auth/me', route => route.fulfill({status:503,json:{error:'unavailable'}}));
  await page.goto('/login.html');
  await page.locator('#guestLogin').click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.locator('#guestLogin')).toBeEnabled();
  await expect(page.locator('#guestLogin')).toHaveText('Continue as Guest');
});
test('guest session must really belong to DEMO', async ({ page }) => {
  await page.route('**/version', route => route.fulfill({json:{environment:'demo'}}));
  await page.route('**/api/auth/me', route => route.fulfill({json:{app_env:'production',user:{role:'admin'}}}));
  await page.goto('/login.html');
  await page.locator('#guestLogin').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/login.html$/);
});

test('mobile navigation leaves full-width content below the sidebar', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.locator('[data-target=weeklyReportHistorySection]').click();
  const main=await page.locator('.main-content').boundingBox();
  const sidebar=await page.locator('.sidebar').boundingBox();
  expect(main.width).toBeGreaterThanOrEqual(360);
  expect(main.x).toBeLessThanOrEqual(20);
  expect(main.y).toBeGreaterThanOrEqual(sidebar.y+sidebar.height-1);
});
