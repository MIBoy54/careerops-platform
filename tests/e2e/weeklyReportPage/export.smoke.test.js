import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("generate weekly report workflow", async ({ page }) => {
  await login(page);

  // Navigate to Contact Status
  await page
    .getByRole("button", { name: /contact status/i })
    .click();

  // Select four companies
await expect(
  page.locator("#contactsTable tbody tr").first()
).toBeVisible();

const checkboxes = page.locator(
"#contactsTable tbody input.select-checkbox"
);

  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();
  await checkboxes.nth(3).check();

  // Verify four selections
  await expect(
    page.getByText(/Selected for Weekly Report:\s*4 of 4/i)
  ).toBeVisible();

  // View selected companies
  await page
    .getByRole("button", { name: /view selected/i })
    .click();

  // Detail Viewer becomes active
  const detailViewer = page.locator("#detailViewerSection");

  await expect(detailViewer).toHaveClass(/active-section/);
  await expect(detailViewer).toBeVisible();

  // Verify Generate Weekly Report button
  const generateButton = detailViewer.getByRole("button", {
    name: /generate weekly report/i
  });

  await expect(generateButton).toBeVisible();
  await expect(generateButton).toBeEnabled();
});