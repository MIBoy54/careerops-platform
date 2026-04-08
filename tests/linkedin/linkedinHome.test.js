const { test } = require('@playwright/test');
const { LinkedInHomePage } = require('../pages/LinkedInHomePage');

test.describe('LinkedIn Guest Home Page', () => {
  test('Homepage loads successfully', async ({ page }) => {
    const home = new LinkedInHomePage(page);

    await home.navigate();
    await home.verifyPageLoaded();
  });

  test('Primary guest CTAs are visible', async ({ page }) => {
    const home = new LinkedInHomePage(page);

    await home.navigate();
    await home.verifyGuestCtas();
  });
});
