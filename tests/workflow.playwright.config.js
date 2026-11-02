import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import base from '../playwright.config.js';
const url='http://127.0.0.1:3115';
export default defineConfig({...base,testDir:'./workflow-e2e',workers:1,
 use:{...base.use,baseURL:url},
 webServer:{...base.webServer,cwd:fileURLToPath(new URL('..',import.meta.url)),url,
   env:{...base.webServer.env,PORT:'3115'},reuseExistingServer:false}
});
