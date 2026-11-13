import { defineConfig, devices } from '@playwright/test';

// End-to-end tests in the three browser engines MecHand supports:
// Chromium (Chrome, Edge), Firefox and WebKit (Safari).
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1400, height: 900 },
    // A level already chosen (B: the whole library, as before levels existed), so the first-use
    // level dialog does not cover the page. e2e/levels.spec.ts starts from an empty storage.
    storageState: {
      cookies: [],
      origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'mechand.level.v1', value: 'B' }] }],
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1400, height: 900 } } },
  ],
});
