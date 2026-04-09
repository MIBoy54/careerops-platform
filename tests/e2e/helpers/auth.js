import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('http://localhost:3000/login.html');

  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('StrongPass123');

  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('CareerOps Landing Page')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#landingPage')).toBeVisible({ timeout: 10000 });
}