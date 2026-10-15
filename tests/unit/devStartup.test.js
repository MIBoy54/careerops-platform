import { expect, it, vi } from 'vitest';
const listen = vi.hoisted(() => vi.fn());
vi.mock('../../src/server.js', () => ({ app: { listen } }));

it('selects DEV before importing the server and binds the DEV launcher only to IPv4 loopback', async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('PORT', '3199');
  try {
    await import('../../scripts/start-dev.js');
    expect(process.env.APP_ENV).toBe('dev');
    expect(listen).toHaveBeenCalledWith('3199', '127.0.0.1', expect.any(Function));
  } finally {
    vi.unstubAllEnvs();
  }
});
