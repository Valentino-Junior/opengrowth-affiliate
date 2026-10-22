import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

// Phase 2 exit check: a player can be linked to an affiliate and a self-referral match is flagged.

test("desk confirms a clean player link (Player 22)", async ({ page }) => {
  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/new-players");
  const row = page.getByRole("row", { name: /player22/ });
  await expect(row.getByText("Unique").first()).toBeVisible();
  await row.getByRole("button", { name: "Confirm link" }).click();
  await expect(page.getByRole("row", { name: /player22/ })).toHaveCount(0);
});

test("self-referral: desk sends Player 23 to ops, ops clears it", async ({ page }) => {
  await login(page, "a2@opengrowth.local");
  await page.goto("/desk/new-players");
  const row = page.getByRole("row", { name: /player23/ });
  await expect(row.getByText("Matches affiliate")).toBeVisible();
  await expect(row.getByRole("button", { name: "Confirm link" })).toHaveCount(0);
  await row.getByRole("button", { name: "Send to ops" }).click();
  await expect(page.getByRole("row", { name: /player23/ })).toHaveCount(0);
  await logout(page);

  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/affiliates");
  await expect(page.getByRole("row", { name: /Affiliate 06/ }).getByText("flagged")).toBeVisible();

  await page.goto("/ops/verification");
  const flag = page.getByRole("row", { name: /player23/ });
  await expect(flag.getByText("Phone matches the affiliate")).toBeVisible();
  await flag.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("row", { name: /player23/ }).getByRole("button", { name: "Clear" })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /player23/ }).getByText("Cleared")).toBeVisible();

  await page.goto("/ops/affiliates");
  await expect(page.getByRole("row", { name: /Affiliate 06/ }).getByText("active")).toBeVisible();
});

test("referral link → player signup → waiting on the desk", async ({ page }) => {
  await page.goto("/r/og-a03");
  await expect(page).toHaveURL(/\/join\/player\?ref=OG-A03/);
  await expect(page.getByText("You were invited with code OG-A03")).toBeVisible();
  await page.getByLabel("Player handle").fill("linkplayer1");
  await page.getByLabel("Email").fill("linkplayer1@example.com");
  await page.getByLabel("Phone number").fill("555-040-0001");
  // The handle hint follows the app.
  await page.getByLabel("Pays with").selectOption("cash_app");
  await expect(page.getByText("Your Cash App $cashtag, like $jordan23.")).toBeVisible();
  await page.getByLabel("Payment handle").fill("$linkplayer1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("You're in.")).toBeVisible();

  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/new-players");
  await expect(page.getByRole("row", { name: /linkplayer1/ }).getByText("Affiliate 03")).toBeVisible();
});

test("one person, one account: player email already used", async ({ page }) => {
  await page.goto("/join/player?ref=OG-A01");
  await page.getByLabel("Player handle").fill("dupeplayer");
  await page.getByLabel("Email").fill("player05@example.com");
  await page.getByLabel("Phone number").fill("555-040-0099");
  // Without an app the form doesn't send; it says what's missing.
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Choose pays with.")).toBeVisible();
  await page.getByLabel("Pays with").selectOption("cash_app");
  await page.getByLabel("Payment handle").fill("$dupeplayer");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("This email is already registered.")).toBeVisible();
});

test("ops registration blocks a phone already on another affiliate (mockup warning)", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/affiliates");
  const form = page.locator("#register");
  await form.getByLabel("Full legal name").fill("Sam Example");
  await form.getByLabel("Email").fill("sam@example.com");
  await form.getByLabel("Phone number").fill("(555) 010-0003");
  await form.getByRole("button", { name: "Check and create code" }).click();
  await expect(form.getByText("This phone number is already on Affiliate 03's account.")).toBeVisible();
});

test("ops registers an affiliate, who can log in with the temporary password", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/affiliates");
  const form = page.locator("#register");
  await form.getByLabel("Full legal name").fill("Riley Fresh");
  await form.getByLabel("Email").fill("riley@example.com");
  await form.getByLabel("Phone number").fill("555-050-0001");
  await form.getByRole("button", { name: "Check and create code" }).click();
  await expect(form.getByText("Riley Fresh is registered.")).toBeVisible();
  const code = await form.locator("dd").nth(0).innerText();
  const temp = await form.locator("dd").nth(2).innerText();
  expect(code).toBe("OG-A07");
  await logout(page);

  await login(page, "riley@example.com", temp);
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/account");
  await expect(page.getByText("OG-A07", { exact: true })).toBeVisible();
});

test("self-serve signup waits for approval, then gets a code", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Full legal name").fill("Casey Signup");
  await page.getByLabel("Email").fill("casey@example.com");
  await page.getByLabel("Phone number").fill("555-060-0001");
  await page.getByLabel("Password", { exact: true }).fill("casey-password");
  await page.getByLabel("Get paid by").selectOption("venmo");
  await page.getByLabel("Payout handle").fill("@casey");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("waiting for approval")).toBeVisible();
  await logout(page);

  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/affiliates");
  await page.getByRole("row", { name: /Casey Signup/ }).getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("row", { name: /Casey Signup/ }).getByText(/OG-A\d+/)).toBeVisible();
});

test("desk adds a walk-in whose payment handle is the affiliate's → straight to ops", async ({ page }) => {
  await login(page, "a3@opengrowth.local");
  await page.goto("/desk/new-players");
  await page.getByRole("button", { name: "Add player" }).click();
  const form = page.getByRole("dialog", { name: "Add a player who gave a code at the desk" });
  await form.getByLabel("Player handle").fill("walkin1");
  await form.getByLabel("Referral code").fill("OG-A02");
  await form.getByLabel("Pays with").selectOption("crypto");
  await form.getByLabel("Payment handle").fill("$affiliate02");
  await form.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByText("walkin1 matches Affiliate 02's own details. Sent to ops for review.")).toBeVisible();

  await logout(page);
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/verification");
  const flag = page.getByRole("row", { name: /walkin1/ });
  await flag.getByRole("button", { name: "Disqualify" }).click();
  await expect(page.getByRole("row", { name: /walkin1/ }).getByText("Disqualified")).toBeVisible();
});
