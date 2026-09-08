import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5500'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'chromium-reduced-motion',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },
  ],
  webServer: process.env.CI ? {
    command: 'node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 5500',
    url: `${baseURL}/auth/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  } : undefined,
})
