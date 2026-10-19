import { expect, test } from "@playwright/test";

// Phase 6: public page, rate limits, security headers, health check.

test("How it works shows the live rules and prizes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bring the players. Take 5% of the profit.");
  await expect(page.getByText("That's $3,000 gross profit, so you get $150 on Monday.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "$10 minimum payout" })).toBeVisible();
  await expect(page.getByText("Payouts over $500 need a quick ID check")).toBeVisible();
  for (const p of ["A car", "A dirt bike", "An iPhone"]) await expect(page.getByRole("heading", { name: p })).toBeVisible();
  const badges = page.getByRole("region", { name: "Status badges" });
  await expect(badges.getByText("$1,000 last month")).toBeVisible();
  await expect(badges.getByText("$2,000+ last month")).toBeVisible();
  await page.getByRole("link", { name: "Read the rules" }).click();
  await expect(page).toHaveURL(/#rules$/);
  await page.getByRole("link", { name: "Become an affiliate" }).first().click();
  await expect(page).toHaveURL("/join");
});

test("security headers are set on every page", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("health check", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("10 wrong passwords lock the email for 15 minutes, even with the right password", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 10; i++) {
    await page.getByLabel("Email").fill("affiliate03@opengrowth.local");
    await page.getByLabel("Password").fill(`wrong-${i}`);
    // Wait for each attempt to reach the server before the next one.
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Log in" }).click()]);
    await expect(page.getByText("Email or password is wrong.")).toBeVisible();
  }
  await page.getByLabel("Email").fill("affiliate03@opengrowth.local");
  await page.getByLabel("Password").fill("opengrowth");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Log in" }).click()]);
  await expect(page.getByText("Too many attempts. Wait 15 minutes and try again.")).toBeVisible();
  await expect(page).toHaveURL("/login");
});
