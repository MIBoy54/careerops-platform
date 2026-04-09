import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('http://localhost:3000/');
  await expect(page.getByText('CareerOps Landing Page')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#landingPage')).toBeVisible({ timeout: 10000 });
}