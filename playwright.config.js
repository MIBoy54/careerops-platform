import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },

  webServer: {
    command: 'npm start',
    env: { APP_ENV: 'test', CI: 'true', DEMO_MODE: 'true' },
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 60000,
  },
});