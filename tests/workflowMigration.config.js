import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/regression/contactWorkflowMigration.test.js'],testTimeout:20000,hookTimeout:30000}});
