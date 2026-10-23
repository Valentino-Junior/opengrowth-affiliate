import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";
import { db, deleteAffiliateByEmail, latestCode, latestEmail } from "./db";

// Email confirmation at signup, and the emails ops actions send. Cleans up after itself (safe with PW_NO_SEED=1).

test.describe.configure({ mode: "serial" });

const email = `confirm-${Date.now()}@example.com`;
const phone = `555-08${String(Date.now()).slice(-5)}`;

test.afterAll(async () => {
  await deleteAffiliateByEmail(email);
  await db.$disconnect();
});

test("signing up asks for the emailed 6-digit code", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Full legal name").fill("Casey Confirm");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill("casey-password");
  await page.getByLabel("Get paid by").selectOption("venmo");
  await page.getByLabel("Payout handle").fill("@casey-confirm");
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page).toHaveURL("/verify-email");
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  expect((await latestEmail(email))?.subject).toMatch(/^\d{6} is your Opengrowth code$/);

  // Asking again straight away is refused.
  await page.getByRole("button", { name: "send a new code" }).click();
  await expect(page.getByText("A code was just sent. Wait a minute before asking for another.")).toBeVisible();

  const code = await latestCode(email);
  await page.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("That code is wrong. 4 tries left.")).toBeVisible();

  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page).toHaveURL("/dashboard?email=confirmed");
  await expect(page.getByText("Email confirmed. Thanks!")).toBeVisible();
  await expect(page.getByText(/waiting for approval/)).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("region", { name: "Profile" }).getByText("Confirmed", { exact: true })).toBeVisible();
});

test("ops sees the confirmed email and approving sends the code by email", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/affiliates");
  const row = page.getByRole("row", { name: /Casey Confirm/ });
  await expect(row.getByText("Email confirmed")).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Approved Casey Confirm: OG-A\d+\. We emailed them\./)).toBeVisible();

  const mail = await latestEmail(email);
  expect(mail?.kind).toBe("approved");
  expect(mail?.body).toMatch(/Your code is OG-A\d+\./);
  await logout(page);
});

test("an unconfirmed email shows a reminder at the top of the dashboard", async ({ page }) => {
  await db.user.update({ where: { email }, data: { emailVerifiedAt: null } });
  await login(page, email, "casey-password");
  await expect(page.getByText(`Confirm your email: we sent a 6-digit code to ${email}.`)).toBeVisible();
  await page.getByRole("link", { name: "Enter code" }).click();
  await expect(page).toHaveURL("/verify-email");
  await page.getByRole("link", { name: "Do this later" }).click();
  await expect(page).toHaveURL("/dashboard");
});
