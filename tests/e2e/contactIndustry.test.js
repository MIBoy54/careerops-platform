import { test, expect } from "@playwright/test";
import { waitForAppReady } from "../helpers/readiness.js";

test("industry loads for the selected record, saves, reloads, clears, and creates", async ({ page, context }, testInfo) => {
  const login = await context.request.post("/api/auth/login", {
    data: { email: process.env.TEST_EMAIL || "test@careerops.local",
      password: process.env.TEST_PASSWORD || "test-password" }
  });
  expect(login.status()).toBe(200);
  const suffix = Date.now() + "-" + testInfo.workerIndex;
  const fixture = (company, industry) => ({ date_contacted: "2026-11-04",
    recruiter_name: "Industry test", company, role_level: "QA Manager",
    hiring_stage: "Applied", position_status: "Awaiting Decision",
    relationship_status: "Active", industry });
  const first = fixture("Industry A " + suffix, "Healthcare");
  const second = fixture("Industry B " + suffix, "Financial Services");
  const firstResponse = await context.request.post("/api/contacts", { data: first });
  const secondResponse = await context.request.post("/api/contacts", { data: second });
  expect(firstResponse.status()).toBe(201);
  expect(secondResponse.status()).toBe(201);
  const secondId = (await secondResponse.json()).id;
  for (const endpoint of ["/api/github/actions-summary", "/api/reports",
    "/api/demo-refresh/latest", "/api/analytics/**"]) {
    await page.route("**" + endpoint, route => route.fulfill({
      status: 500, contentType: "application/json", body: "{}"
    }));
  }
  const getContact = async id => (await (await context.request.get("/api/contacts")).json())
    .find(contact => Number(contact.id) === Number(id));
  const save = async () => {
    const response = page.waitForResponse(r => /\/api\/contacts(?:\/\d+)?$/.test(r.url()) &&
      ["POST", "PUT"].includes(r.request().method()));
    await page.locator("#contactForm button[type=submit]").click();
    expect((await response).ok()).toBe(true);
    await expect(page.locator("#company")).toHaveValue("");
  };
  const editSecond = async () => {
    await page.locator('[data-target="savedContactsSection"]').click();
    await page.locator('.edit-btn[data-id="' + secondId + '"]').click();
    await expect(page.locator("#company")).toHaveValue(second.company);
  };
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('[data-target="contactFormSection"]').click();
  await page.locator("#company").fill(first.company);
  await page.locator("#companySuggestions .suggestion-item").filter({ hasText: first.company }).click();
  await expect(page.locator("#industry")).toHaveValue("Healthcare");
  await expect(page.locator("#companySearchStatus")).toContainText(first.company);
  await editSecond();
  await expect(page.locator("#companySearchStatus")).toHaveText("");
  await expect(page.locator("#industry")).toHaveValue("Financial Services");
  await page.locator("#industry").fill("Aerospace Research");
  await page.screenshot({ path: testInfo.outputPath("industry-form.png"), fullPage: true });
  await save();
  expect((await getContact(secondId)).industry).toBe("Aerospace Research");
  await page.reload();
  await waitForAppReady(page);
  await editSecond();
  await expect(page.locator("#industry")).toHaveValue("Aerospace Research");
  await page.locator("#industry").fill("");
  await save();
  expect((await getContact(secondId)).industry).toBeNull();

  await page.locator("#recruiter_name").fill("Industry create test");
  const createdCompany = "Industry created " + suffix;
  await page.locator("#company").fill(createdCompany);
  await page.locator("#industry").fill("Software");
  await save();
  const created = (await (await context.request.get("/api/contacts")).json())
    .find(contact => contact.company === createdCompany);
  expect(created.industry).toBe("Software");
  const omitted = await context.request.put("/api/contacts/" + created.id, {
    data: { ...fixture(createdCompany, undefined) }
  });
  expect(omitted.ok()).toBe(true);
  expect((await getContact(created.id)).industry).toBe("Software");
  const invalid = await context.request.put("/api/contacts/" + created.id, {
    data: { ...fixture(createdCompany, "x".repeat(101)) }
  });
  expect(invalid.status()).toBe(400);
  expect((await getContact(created.id)).industry).toBe("Software");
});

