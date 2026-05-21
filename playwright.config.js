const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20000,
  use: {
    baseURL: 'http://localhost:3456',
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  webServer: {
    command: 'npx serve . -p 3456 -s',
    port: 3456,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [['list']],
});
