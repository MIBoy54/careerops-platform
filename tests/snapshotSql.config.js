import { defineConfig } from 'vitest/config';
export default defineConfig({test:{
  include:['tests/regression/demoSnapshotSql.test.js'],testTimeout:15000
}});
