import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/unit/sessionTrend.test.js', 'tests/regression/sessionTrend*.test.js'],
  testTimeout: 15000, hookTimeout: 30000
} });
