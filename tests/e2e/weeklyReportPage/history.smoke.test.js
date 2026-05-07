import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("Generated weekly report appears in Weekly Report History", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Weekly Report History" }).click();

  await expect(
    page.getByRole("heading", { name: "Weekly Report History" })
  ).toBeVisible();

  await expect(
    page.locator("#weekly-report-history-table")
  ).toBeVisible();

  const rows = page.locator("#weekly-report-history-table tbody tr");

  await expect(rows.first()).toBeVisible();

  await expect(
    rows.first().locator('input[type="radio"]')
  ).toBeVisible();

  await expect(
    rows.first().getByRole("button", { name: "View" })
  ).toBeVisible();
});