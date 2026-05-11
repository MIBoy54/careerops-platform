import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("views selected contacts in detail viewer", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Saved Contacts" }).click();

  const checkboxes = page.locator(".select-checkbox");

  await expect(checkboxes.first()).toBeVisible();

  for (let i = 0; i < 4; i++) {
    await checkboxes.nth(i).check();
  }

  await page.getByRole("button", { name: "View Selected" }).click();

  await expect(page.locator("#detailViewerSection")).toHaveClass(/active-section/);

  await expect(
    page.getByRole("heading", { name: "Selected Employer Details" })
  ).toBeVisible();

  await expect(page.locator(".contact-card")).toHaveCount(4);
});