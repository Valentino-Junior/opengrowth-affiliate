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
    await page.getByLabel("Password", { exact: true }).fill(`wrong-${i}`);
    // Wait for each attempt to reach the server before the next one.
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Log in" }).click()]);
    await expect(page.getByText("Email or password is wrong")).toBeVisible();
  }
  await page.getByLabel("Email").fill("affiliate03@opengrowth.local");
  await page.getByLabel("Password", { exact: true }).fill("opengrowth");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Log in" }).click()]);
  await expect(page.getByText("Too many attempts. Wait 15 minutes and try again.")).toBeVisible();
  await expect(page).toHaveURL("/login");
});

test("centred footer with the current year on public, login and signed-in pages", async ({ page }) => {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date());
  for (const url of ["/", "/login", "/join"]) {
    await page.goto(url);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByText(`© ${year} Opengrowth by Young Money. All rights reserved.`)).toBeVisible();
    expect(await footer.locator("p").evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill("affiliate02@opengrowth.local");
  await page.getByLabel("Password", { exact: true }).fill("opengrowth");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/dashboard");
  await expect(page.getByRole("contentinfo").getByText(`© ${year}`)).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(1); // only the shared footer
});

test("favicon and app icons are the OG mark", async ({ page, request }) => {
  await page.goto("/");
  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(icons.some((h) => h?.startsWith("/favicon.ico"))).toBe(true);
  expect(icons.some((h) => h?.startsWith("/icon.png"))).toBe(true);
  expect(icons.some((h) => h?.startsWith("/apple-icon.png"))).toBe(true);
  for (const path of ["/favicon.ico", "/icon.png", "/apple-icon.png"]) expect((await request.get(path)).status()).toBe(200);
});

test("ops overview: each card opens the tab where it's handled", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ops@opengrowth.local");
  await page.getByLabel("Password", { exact: true }).fill("opengrowth");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/ops");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const tab of ["Overview", "Payout run", "Verification", "Affiliates", "Transaction desk"]) await expect(nav.getByRole("link", { name: tab })).toBeVisible();
  await page.getByRole("link", { name: /IDs to review/ }).click();
  await expect(page).toHaveURL("/ops/verification");
  // Verification has a tab per kind of check.
  const tabs = page.getByRole("navigation", { name: "Verification" });
  for (const t of ["IDs to review", "Who needs an ID", "Flags", "Prizes"]) await expect(tabs.getByRole("link", { name: new RegExp(`^${t}`) })).toBeVisible();
  await tabs.getByRole("link", { name: /^Flags/ }).click();
  await expect(page).toHaveURL("/ops/verification/flags");
  await expect(page.getByRole("heading", { name: "Open flags" })).toBeVisible();
  // The payout run is only about payouts now.
  await page.goto("/ops/payouts");
  await expect(page.getByRole("region", { name: "Who still needs an ID" })).toHaveCount(0);
});
