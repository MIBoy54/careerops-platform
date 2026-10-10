import { defineConfig } from '@playwright/test';

const testPort = Number(process.env.PLAYWRIGHT_PORT || 3100);
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    baseURL,
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },

  webServer: {
    command: 'npm start',
    env: {
      APP_ENV: 'test',
      CI: 'true',
      DEMO_MODE: 'true',
      PORT: String(testPort),
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
