import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config.js';

describe('CI and local test-server ownership', () => {
  it('gives Playwright ownership of a database-free server without reusing another server', () => {
    expect(config.webServer.command).toBe('npm start');
    expect(config.webServer.reuseExistingServer).toBe(false);
    expect(config.webServer.env).toMatchObject({ APP_ENV: 'test', CI: 'true', DEMO_MODE: 'true' });
  });
  it('does not prestart a second server in CI, and retains smoke and E2E invocations', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/careerops-ci.yml', import.meta.url), 'utf8');
    expect(workflow).not.toMatch(/name:\s*Start App|npm start\s*&|wait-on/);
    expect(workflow).toContain('npx playwright test tests/e2e/smoke --workers=1');
    expect(workflow).toContain('npx playwright test tests/e2e --workers=1');
  });
});
