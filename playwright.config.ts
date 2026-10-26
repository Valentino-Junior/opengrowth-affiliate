import { defineConfig } from "@playwright/test";

// PW_CHANNEL=chrome runs against the locally installed Google Chrome instead of a downloaded browser.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1, // tests share one database
  // On GitHub, failures also appear as notes on the run (readable without opening the log), and a hang stops early.
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalTimeout: process.env.CI ? 12 * 60_000 : undefined,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium", channel: process.env.PW_CHANNEL } }],
});
