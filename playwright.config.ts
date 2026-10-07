import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * `npm run test:e2e` first resets the `maison_e2e` DB (tests/e2e/prepare-db.ts), then runs against a production build on :3200 backed by the disposable `maison_e2e` database.
 * Projects run one after another because they share state (stock, global discount).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    // Deterministic runs (and exercises the reduced-motion path): no smooth scroll / entrance animations.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
