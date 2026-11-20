// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const e2eBaseUrl = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
const testJwtEnvironment = {
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || 'test-jwt-secret',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
};

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: '../e2e-tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  // Every browser test uses the same test database, so files must run serially
  // to prevent one feature's setup from changing another feature's fixture data.
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: e2eBaseUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'node ../src/server.js',
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, ...testJwtEnvironment },
  },

  globalSetup: require.resolve('./playwright-global-setup'),
});
