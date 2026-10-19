import { defineConfig } from "@playwright/test";

// PW_CHANNEL=chrome runs against the locally installed Google Chrome instead of a downloaded browser.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1, // tests share one database
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium", channel: process.env.PW_CHANNEL } }],
});
