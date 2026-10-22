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

test("change password: wrong current and mismatch are refused; the new one works; then put back", async ({ page }) => {
  const change = async (current: string, next: string, confirm = next) => {
    const form = page.getByLabel("Change password");
    await form.getByLabel("Current password").fill(current);
    await form.getByLabel("New password", { exact: true }).fill(next);
    await form.getByLabel("Confirm new password").fill(confirm);
    await form.getByRole("button", { name: "Change password" }).click();
    return form;
  };
  await login(page, "affiliate04@opengrowth.local");
  await page.goto("/account");
  await expect((await change("not-it", "newpass-123")).getByText("Your current password is wrong.")).toBeVisible();
  await expect((await change("opengrowth", "newpass-123", "other-pass")).getByText("The two new passwords don't match.")).toBeVisible();
  await expect((await change("opengrowth", "newpass-123")).getByText(/^Password changed\./)).toBeVisible();
  await logout(page);

  await login(page, "affiliate04@opengrowth.local", "newpass-123");
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/account");
  await expect((await change("newpass-123", "opengrowth")).getByText(/^Password changed\./)).toBeVisible();
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
