import { expect, test } from "@playwright/test";
import { login } from "../helpers/auth";

test("export remains disabled until a report is selected", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Weekly Report History" }).click();

  await expect(
    page.getByRole("button", { name: "Export Selected Report" })
  ).toBeDisabled();
});