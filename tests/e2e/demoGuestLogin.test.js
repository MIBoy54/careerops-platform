import { expect, test } from "@playwright/test";

test("DEMO guest login uses the guest session without credentials", async ({ page }) => {
  const requests = [];

  await page.route("**/api/auth/**", async route => {
    const request = route.request();
    requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData()
    });

    if (request.url().endsWith("/api/auth/me")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          app_env: "demo",
          user: {
            id: 0,
            role: "guest",
            email: "guest@careerops.com"
          }
        })
      });
    }

    return route.fulfill({ status: 403 });
  });

  // Simulate the public DEMO hostname for this isolated browser test.
  await page.route("**/login.html", async route => {
    const response = await route.fetch();
    const html = await response.text();

    await route.fulfill({
      response,
      body: html.replace(
        'window.location.hostname === "democareerops-platform.com"',
        'window.location.hostname === "127.0.0.1"'
      )
    });
  });

  await page.goto("/login.html");

  const guestButton = page.locator("#guestLogin");
  await expect(guestButton).toBeVisible();

  await guestButton.click();

  await expect(page).toHaveURL("http://127.0.0.1:3100/");

  await expect.poll(() =>
    requests.some(request =>
      request.url.endsWith("/api/auth/me") &&
      request.method === "GET"
    )
  ).toBe(true);

  expect(requests.some(request =>
    request.url.endsWith("/api/auth/login")
  )).toBe(false);

  expect(requests.every(request => !request.body)).toBe(true);
});