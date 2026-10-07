import { expect } from "@playwright/test";

export async function waitForAppReady(page) {
  await expect(page.locator("html")).toHaveAttribute("data-careerops-ready", "true", {
    timeout: 10000
  });
}
