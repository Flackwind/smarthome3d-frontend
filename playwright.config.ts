import { defineConfig, devices } from '@playwright/test';
const production=process.env['SH3D_PRODUCTION']==='1',backend=process.env['SH3D_BACKEND_E2E']==='1';
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:false,workers:1,timeout:45000,
  testMatch:production?'production.spec.ts':backend?'backend.spec.ts':'workspace.spec.ts',
  expect:{timeout:10000},use:{baseURL:production?'http://127.0.0.1:4308':'http://127.0.0.1:4307',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env['CHROME_PATH']??'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}],
  webServer:{command:production?'node scripts/serve-built.mjs':'npm start -- --port 4307',url:production?'http://127.0.0.1:4308':'http://127.0.0.1:4307',reuseExistingServer:false,timeout:120000}
});
