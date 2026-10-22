import { expect, test } from "@playwright/test";

// Phase 1 exit check: each role logs in and lands on its own screen; nobody gets into another role's area.
// Needs the dev seed (npm run db:seed) and a running server.

const PASSWORD = "opengrowth";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}

const roles = [
  { email: "affiliate01@opengrowth.local", home: "/dashboard", heading: "Welcome back, Affiliate" },
  { email: "a1@opengrowth.local", home: "/desk", heading: "Log it. Verify it. Then it counts." },
  { email: "ops@opengrowth.local", home: "/ops/payouts", heading: /Week of|No closed weeks yet/ },
  { email: "admin@opengrowth.local", home: "/admin/settings", heading: "Settings" },
];

for (const r of roles) {
  test(`${r.email} lands on ${r.home}`, async ({ page }) => {
    await login(page, r.email);
    await expect(page).toHaveURL(r.home);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(r.heading);
  });
}

test("logged-out visitors are sent to login", async ({ page }) => {
  await page.goto("/ops/payouts");
  await expect(page).toHaveURL("/login");
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ops@opengrowth.local");
  await page.getByLabel("Password").fill("nope");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong.")).toBeVisible();
});

test("an employee cannot open the payout run", async ({ page }) => {
  await login(page, "a2@opengrowth.local");
  await expect(page).toHaveURL("/desk");
  await page.goto("/ops/payouts");
  await expect(page).toHaveURL("/desk");
});

test("an affiliate sees their referral code", async ({ page }) => {
  await login(page, "affiliate02@opengrowth.local");
  await expect(page.getByText("OG-A02", { exact: true })).toBeVisible();
  await expect(page.getByText("/r/OG-A02")).toBeVisible();
  await expect(page.getByText("ID verified")).toBeVisible();
});

test("admin saves settings and the public page follows", async ({ page }) => {
  await login(page, "admin@opengrowth.local");
  await page.getByLabel("Minimum payout ($)").fill("15");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "$15 minimum payout" })).toBeVisible();
  // put it back
  await page.goto("/admin/settings");
  await page.getByLabel("Minimum payout ($)").fill("10");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
});
