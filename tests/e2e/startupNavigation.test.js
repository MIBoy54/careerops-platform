import { expect, test } from "@playwright/test";

test.use({ screenshot: "only-on-failure" });

for (const analyticsStatus of [200, 500]) {
  test(`early navigation survives analytics startup HTTP ${analyticsStatus}`, async ({ page, context }, testInfo) => {
    const events = [];
    const record = (event, details = {}) => events.push({ time: Date.now(), event, ...details });
    page.on("console", (message) => {
      if (/SHOW SECTION:|Analytics startup failed:/.test(message.text())) {
        record("console", { text: message.text() });
      }
    });

    // Authenticate and seed via the API; deliberately bypass readiness-waiting helpers.
    const login = await context.request.post("/api/auth/login", {
      data: {
        email: process.env.TEST_EMAIL || "test@careerops.local",
        password: process.env.TEST_PASSWORD || "test-password"
      }
    });
    expect(login.status()).toBe(200);
    const company = `Startup navigation ${analyticsStatus} ${Date.now()}-${testInfo.workerIndex}`;
    const seed = await context.request.post("/api/contacts", {
      data: {
        date_contacted: "2026-04-13",
        recruiter_name: "Startup navigation fixture",
        company,
        role_level: "QA Engineer",
        role_type: "QA Operations",
        location: "Remote",
        comp_range: "$100K-$120K",
        status: "Applied",
        relationship_status: "Active",
        reported_unemployment: "No"
      }
    });
    expect(seed.status()).toBe(201);

    // Optional services are controlled so this test isolates startup/navigation ordering.
    for (const endpoint of [
      "/api/github/actions-summary", "/api/reports", "/api/demo-refresh/latest",
      "/api/analytics/**"
    ]) {
      await page.route(`**${endpoint}`, (route) => route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Controlled optional-service failure" })
      }));
    }

    let releaseAnalytics;
    let analyticsRequested;
    const released = new Promise((resolve) => { releaseAnalytics = resolve; });
    const requested = new Promise((resolve) => { analyticsRequested = resolve; });
    await page.route("**/api/analytics/start", async (route) => {
      record("analytics-held");
      analyticsRequested();
      await released;
      record("analytics-released", { status: analyticsStatus });
      await route.fulfill({
        status: analyticsStatus,
        contentType: "application/json",
        body: JSON.stringify(analyticsStatus === 200 ? { success: true } : { error: "Controlled startup failure" })
      });
    });

    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      // This request begins after real navigation handlers are registered.
      await requested;
      await expect(page.locator("html")).not.toHaveAttribute("data-careerops-ready", "true");
      await page.getByTestId("saved-contacts-nav").click();
      const savedContacts = page.locator("#savedContactsSection");
      await expect(savedContacts).toHaveClass(/active-section/);
      await expect(savedContacts).toBeVisible();
      record("saved-contacts-active-while-startup-pending");

      releaseAnalytics();
      await expect(page.locator("html")).toHaveAttribute("data-careerops-ready", "true", { timeout: 10000 });
      record("startup-ready");
      await expect(savedContacts).toHaveClass(/active-section/);
      await expect(savedContacts).toBeVisible();
      await expect(page.locator("#telemetrySection")).toBeHidden();
      await expect(savedContacts.getByText(company, { exact: true })).toBeVisible();
      record("navigation-preserved-after-startup");
    } finally {
      releaseAnalytics();
      await testInfo.attach("startup-navigation-events", {
        body: JSON.stringify(events, null, 2),
        contentType: "application/json"
      });
    }
  });
}
