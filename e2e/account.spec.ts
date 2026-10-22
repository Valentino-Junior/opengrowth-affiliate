import { expect, test, type Page } from "@playwright/test";
import { login, logout } from "./helpers";

// My profile: everyone can see their details and change their name and password; affiliates their payout details.
// Every test puts back what it changed, so this file is safe to run against a dev database (PW_NO_SEED=1).

test.describe.configure({ mode: "serial" });

const openProfile = async (page: Page) => {
  await page.getByRole("link", { name: /My profile/ }).click();
  await page.waitForURL("/account");
};

test("the header's profile button opens My profile with the account's details", async ({ page }) => {
  await login(page, "affiliate04@opengrowth.local");
  await expect(page.getByRole("link", { name: "My profile: Affiliate 04" })).toContainText("AF");
  await openProfile(page);
  const card = page.getByLabel("Profile");
  await expect(card.getByRole("heading", { name: "Affiliate 04" })).toBeVisible();
  await expect(card.getByText("affiliate04@opengrowth.local")).toBeVisible();
  await expect(card.getByText("OG-A04")).toBeVisible();
});

test("change password: wrong current and mismatch are refused; success logs you out everywhere; then put back", async ({ page, browser }) => {
  const change = async (current: string, next: string, confirm = next) => {
    const form = page.getByLabel("Change password");
    await form.getByLabel("Current password").fill(current);
    await form.getByLabel("New password", { exact: true }).fill(next);
    await form.getByLabel("Confirm new password").fill(confirm);
    await form.getByRole("button", { name: "Change password" }).click();
    return form;
  };
  // A second device, signed in before the change.
  const other = await browser.newPage();
  await login(other, "affiliate04@opengrowth.local");

  await login(page, "affiliate04@opengrowth.local");
  await page.goto("/account");
  await expect((await change("not-it", "newpass-123")).getByText("Your current password is wrong.")).toBeVisible();
  await expect((await change("opengrowth", "newpass-123", "other-pass")).getByText("The two new passwords don't match.")).toBeVisible();
  await change("opengrowth", "newpass-123");
  await expect(page).toHaveURL("/login?password=changed");
  await expect(page.getByText("Password changed. Log in with your new password.")).toBeVisible();

  // This browser and the other device are both logged out.
  await page.goto("/account");
  await expect(page).toHaveURL("/login");
  await other.goto("/dashboard");
  await expect(other).toHaveURL("/login");
  await other.close();

  await login(page, "affiliate04@opengrowth.local", "newpass-123");
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/account");
  await change("newpass-123", "opengrowth");
  await expect(page).toHaveURL("/login?password=changed");
});

test("the payout handle hint follows the payment app", async ({ page }) => {
  await page.goto("/join");
  const handle = page.getByLabel("Payout handle");
  await expect(page.getByText("Where your commission is sent. Pick how you get paid first.")).toBeVisible();
  await page.getByLabel("Get paid by").selectOption("venmo");
  await expect(page.getByText("Your Venmo username, like @jordan-23.")).toBeVisible();
  await expect(handle).toHaveAttribute("placeholder", "@username");
  await page.getByLabel("Get paid by").selectOption("crypto");
  await expect(page.getByText(/Your wallet address\. Double-check it/)).toBeVisible();
});

test("payout details need the current password; then put back", async ({ page }) => {
  await login(page, "affiliate04@opengrowth.local");
  await page.goto("/account");
  const save = async (handle: string, password: string) => {
    const form = page.getByLabel("Payout details");
    await form.getByLabel("Payout handle").fill(handle);
    await form.getByLabel("Current password").fill(password);
    await form.getByRole("button", { name: "Save payout details" }).click();
    return form;
  };
  await expect((await save("$aff04new", "wrong")).getByText("Your current password is wrong.")).toBeVisible();
  await expect((await save("$aff04new", "opengrowth")).getByText("Payout details saved. Your next payout goes here.")).toBeVisible();
  await expect(page.getByLabel("Profile").getByText("Apple Pay · $aff04new")).toBeVisible();
  await expect((await save("affiliate04", "opengrowth")).getByText("Payout details saved.")).toBeVisible();
});

test("staff change their display name; the header follows; then put back", async ({ page }) => {
  await login(page, "a3@opengrowth.local");
  await openProfile(page);
  await page.getByLabel("Display name").fill("Jordan A3");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("link", { name: "My profile: Jordan A3" })).toBeVisible();
  await page.getByLabel("Display name").fill("Employee A3");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("link", { name: "My profile: Employee A3" })).toBeVisible();
});

test("an affiliate with a verified ID can't change their legal name", async ({ page }) => {
  await login(page, "affiliate02@opengrowth.local");
  await page.goto("/account");
  await expect(page.getByLabel("Full legal name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save name" })).toHaveCount(0);
  await expect(page.getByText(/Locked: it must match your ID/)).toBeVisible();
});
