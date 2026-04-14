import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { goToSavedContacts } from '../helpers/navigation.js';

test('Detail Viewer requires at least one selected contact', async ({ page }) => {
  await login(page);
  await goToSavedContacts(page);

  const checkboxes = page.locator('#contactsTable tbody input.select-checkbox');

  await expect(checkboxes.first()).toBeAttached();
  await expect(page.locator('#viewButton')).toBeDisabled();

  await checkboxes.first().evaluate((checkbox) => {
    checkbox.click();
  });
  await expect(page.locator('#viewButton')).toBeEnabled();

  await checkboxes.first().evaluate((checkbox) => {
    checkbox.click();
  });
  await expect(page.locator('#viewButton')).toBeDisabled();
});