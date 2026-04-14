import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { goToSavedContacts } from '../helpers/navigation.js';

test('Detail Viewer requires at least one selected contact', async ({ page }) => {
  await login(page);
  await goToSavedContacts(page);

  await expect(page.locator('#viewButton')).toBeDisabled();
});