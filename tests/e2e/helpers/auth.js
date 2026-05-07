import { expect } from "@playwright/test";
import "dotenv/config";

export async function login(page) {
  await page.goto("/login.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#password")).toBeVisible({ timeout: 10000 });

  await page.fill("#email", process.env.TEST_EMAIL || "test@careerops.local");
  await page.fill("#password", process.env.TEST_PASSWORD || "test-password");

  const [response] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/auth/login")),
    page.click('button[type="submit"]')
  ]);

  if (![200, 302].includes(response.status())) {
    const body = await response.text().catch(() => "");
    console.log("LOGIN BODY:", body);
    throw new Error(`Login failed: ${response.status()}`);
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#logoutBtn")).toBeVisible({ timeout: 10000 });
}