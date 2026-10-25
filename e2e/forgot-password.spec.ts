import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { login, PASSWORD } from "./helpers";
import { db, latestCode, latestEmail } from "./db";

// Forgot password: emailed code → new password → logged out everywhere. Puts Affiliate 04's password back afterwards.

test.describe.configure({ mode: "serial" });

const email = "affiliate04@opengrowth.local";

test.afterAll(async () => {
  await db.user.update({ where: { email }, data: { passwordHash: await bcrypt.hash(PASSWORD, 10) } });
  await db.$disconnect();
});

test("an unknown email gets the same answer, and no email is sent", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("If nobody-here@example.com has an account, we've emailed it a 6-digit code.")).toBeVisible();
  expect(await latestEmail("nobody-here@example.com")).toBeNull();
});

test("reset with the emailed code, then only the new password works", async ({ page, browser }) => {
  // Already logged in somewhere else: the reset ends that session too.
  const other = await browser.newPage();
  await login(other, email);

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(`If ${email} has an account`)).toBeVisible();
  expect((await latestEmail(email))?.subject).toMatch(/^\d{6} is your Opengrowth password reset code$/);
  const code = await latestCode(email);

  await page.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
  await page.getByLabel("New password", { exact: true }).fill("fresh-password-04");
  await page.getByLabel("New password again").fill("fresh-password-04");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("That code is wrong. 4 tries left.")).toBeVisible();

  await page.getByLabel("6-digit code").fill(code);
  await page.getByLabel("New password again").fill("something-else");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("The two passwords don't match.")).toBeVisible();

  await page.getByLabel("New password again").fill("fresh-password-04");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL("/login?password=reset");
  await expect(page.getByText("Your new password is set. Log in with your new password.")).toBeVisible();

  await other.reload();
  await expect(other).toHaveURL("/login");
  await other.close();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
  await login(page, email, "fresh-password-04");
  await expect(page).toHaveURL("/dashboard");
});
