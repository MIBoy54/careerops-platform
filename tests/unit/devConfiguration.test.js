import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { loadEnvironment, resolveEnvironment } from '../../src/environment.js';

// Only synthetic files in a temporary directory; never read workstation configuration.
const settings = { APP_ENV: 'dev', DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'careerops_dev',
  DB_USER: 'careerops_dev_app', DB_PASSWORD: 'SYNTHETIC_PASSWORD_SENTINEL',
  SESSION_SECRET: 'SYNTHETIC_SESSION_SENTINEL', SESSION_TREND_SOURCE_TIME_ZONE: 'America/Chicago' };
let directory;
const write = (file, values) => writeFileSync(join(directory, file), Object.entries(values)
  .filter(([, value]) => value !== undefined).map(([key, value]) => `${key}=${value}`).join('\n'));
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'careerops-dev-config-')); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('explicit DEV file selection using real dotenv and synthetic files', () => {
  it('loads only .env.dev into the supplied environment and leaves process.env untouched', () => {
    write('.env.dev', settings);
    write('.env', { DB_HOST: 'remote.invalid', LEGACY_ONLY: 'legacy' });
    const before = { ...process.env };
    const env = { APP_ENV: 'dev' };
    loadEnvironment(env, dotenv.config, directory);
    expect(env).toEqual(settings);
    expect(resolveEnvironment(env).primary).toMatchObject({ host: '127.0.0.1', database: 'careerops_dev', user: 'careerops_dev_app' });
    expect(process.env).toEqual(before);
  });
  it('fails for a missing .env.dev even if .env and inherited settings are complete', () => {
    write('.env', settings);
    expect(() => loadEnvironment({ ...settings }, dotenv.config, directory)).toThrow('no .env fallback');
  });
  it('does not allow legacy .env to select DEV through generic startup', () => {
    write('.env', settings);
    const env = {};
    expect(() => loadEnvironment(env, options => dotenv.config({ ...options, processEnv: env }), directory))
      .toThrow('.env cannot select DEV');
  });
  it.each(['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET', 'SESSION_TREND_SOURCE_TIME_ZONE'])(
    'requires %s in the file even when inherited', key => {
      write('.env.dev', { ...settings, [key]: undefined });
      expect(() => loadEnvironment({ ...settings }, dotenv.config, directory)).toThrow(`DEV requires ${key}`);
      expect(() => resolveEnvironment({ ...settings, [key]: ' ' })).toThrow(key);
    });
  it.each([
    ['APP_ENV', 'production'], ['DB_HOST', 'remote.invalid'], ['DB_NAME', 'careerops_qa'],
    ['DB_USER', 'root'], ['DB_PORT', '3306.0']
  ])('rejects unsafe file configuration %s before connection creation', (key, value) => {
    write('.env.dev', { ...settings, [key]: value });
    expect(() => loadEnvironment({ APP_ENV: 'dev' }, dotenv.config, directory)).toThrow();
  });
  it.each(['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET', 'SESSION_TREND_SOURCE_TIME_ZONE'])(
    'rejects conflicting inherited %s without changing the environment', key => {
      write('.env.dev', settings);
      const env = { APP_ENV: 'dev', [key]: 'INHERITED_SECRET_SENTINEL' };
      expect(() => loadEnvironment(env, dotenv.config, directory)).toThrow(`inherited ${key}`);
      expect(env[key]).toBe('INHERITED_SECRET_SENTINEL');
    });
  it.each(['RAILWAY_PROJECT_ID', 'DEMO_DB_HOST', 'MYSQL_URL', 'DATABASE_URL'])(
    'does not hide inherited deployment binding %s', key => {
      write('.env.dev', settings);
      expect(() => loadEnvironment({ APP_ENV: 'dev', [key]: 'synthetic' }, dotenv.config, directory)).toThrow('bindings');
    });
  it('reports file errors without logging dotenv errors or exposing values', () => {
    const logs = ['log', 'error', 'warn', 'debug'].map(key => vi.spyOn(console, key).mockImplementation(() => {}));
    const loader = () => ({ error: new Error(settings.DB_PASSWORD) });
    let message;
    try { loadEnvironment({ APP_ENV: 'dev' }, loader, directory); } catch (error) { message = error.message; }
    expect(message).toContain('readable .env.dev');
    expect(message).not.toContain(settings.DB_PASSWORD);
    logs.forEach(log => expect(log).not.toHaveBeenCalled());
  });
  it.each(['qa', 'production', 'demo'])('preserves %s loading and inherited variable precedence', appEnv => {
    write('.env', { DB_PASSWORD: 'FILE_SENTINEL' });
    write('.env.demo', { DB_PASSWORD: 'DEMO_FILE_SENTINEL' });
    const env = { APP_ENV: appEnv, DB_PASSWORD: 'INHERITED_SENTINEL' };
    const loader = vi.fn(options => dotenv.config({ ...options, processEnv: env }));
    loadEnvironment(env, loader, directory);
    expect(loader).toHaveBeenCalledWith({ path: `${directory}/${appEnv === 'demo' ? '.env.demo' : '.env'}`, quiet: true });
    expect(env.DB_PASSWORD).toBe('INHERITED_SENTINEL');
  });
});
