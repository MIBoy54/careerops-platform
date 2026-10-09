import { expect, test } from '@playwright/test';

test('Playwright-owned server is database-free and denies synchronization', async ({ request }) => {
  expect((await request.get('/health')).status()).toBe(200);
  expect((await request.get('/env-check')).status()).toBe(401);
  const login = await request.post('/api/auth/login', {
    data: { email: 'ownership-fixture@example.test', password: 'fixture' }
  });
  expect(login.status()).toBe(200);
  const metadata = await request.get('/env-check');
  expect(await metadata.json()).toEqual({ app_env: 'test', database: null, demo_sync_enabled: false });
  expect((await request.post('/api/demo-refresh')).status()).toBe(403);
});
