import { defineConfig, devices } from "@playwright/test";

/**
 * The e2e tier: a real browser against the real standalone server.
 *
 * It exists because jsdom has no layout engine — every element there reports a
 * zero-sized box, so the unit tier can happily agree that a table fits a screen
 * it overflows. Anything about what a person can actually see is only
 * answerable here.
 *
 * `webServer` starts `npm run dev` itself, so the suite cannot pass against a
 * stale server somebody left running.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://localhost:5178",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // A real phone viewport, because the fleet table is the thing most likely
    // to overflow one and jsdom cannot tell us that it does.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5178",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
