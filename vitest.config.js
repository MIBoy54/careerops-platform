import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/validation/**/*.test.js'],
    exclude: ['tests/e2e/**', 'tests/linkedin/**']
  }
});