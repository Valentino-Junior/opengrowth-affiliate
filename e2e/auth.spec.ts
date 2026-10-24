import { expect, test } from "@playwright/test";

// Phase 1 exit check: each role logs in and lands on its own screen; nobody gets into another role's area.
// Needs the dev seed (npm run db:seed) and a running server.

const PASSWORD = "opengrowth";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  // Wait until the login has really finished before the test moves on.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const roles = [
  { email: "affiliate01@opengrowth.local", home: "/dashboard", heading: "Welcome back, Affiliate" },
  { email: "a1@opengrowth.local", home: "/desk", heading: "Log it. Verify it. Then it counts." },
  { email: "ops@opengrowth.local", home: "/ops", heading: "What needs you" },
  { email: "admin@opengrowth.local", home: "/ops", heading: "What needs you" },
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
  await page.getByLabel("Password", { exact: true }).fill("nope");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
});

test("an employee cannot open the payout run", async ({ page }) => {
  await login(page, "a2@opengrowth.local");
  await expect(page).toHaveURL("/desk");
  await page.goto("/ops/payouts");
  await expect(page).toHaveURL("/desk");
});

test("desk and ops are separate: neither can open the other's area", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  for (const path of ["/desk", "/desk/log", "/desk/queue", "/desk/new-players"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/ops");
  }
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /desk/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");

  await login(page, "a1@opengrowth.local");
  for (const path of ["/ops", "/ops/verification", "/ops/transactions", "/admin/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/desk");
  }
});

test("an affiliate sees their referral code on their profile, not the dashboard", async ({ page }) => {
  await login(page, "affiliate02@opengrowth.local");
  await expect(page.getByRole("region", { name: "Referral code" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Account verification" })).toHaveCount(0);
  await page.goto("/account");
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
