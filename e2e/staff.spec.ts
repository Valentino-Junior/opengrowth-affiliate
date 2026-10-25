import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

// Admin manages staff logins: add, reset a password, turn off and on. Only the login created here is changed.

test.describe.configure({ mode: "serial" });

let temp = "";

test("admin adds a desk employee, who logs in with the temporary password", async ({ page }) => {
  await login(page, "admin@opengrowth.local");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Staff" }).click();
  await expect(page).toHaveURL("/admin/staff");
  await page.getByRole("button", { name: "Add staff" }).click();
  const form = page.getByRole("dialog", { name: "Add a staff login" });
  await form.getByLabel("Role").selectOption("employee");
  await form.getByLabel("Name").fill("Taylor Desk");
  await form.getByLabel("Code").fill("a4");
  await form.getByLabel("Email", { exact: true }).fill("a4@opengrowth.local");
  await form.getByLabel("Phone number").fill("555-000-0044");
  await form.getByLabel("Team").fill("Team A");
  await form.getByRole("button", { name: "Create login" }).click();
  await expect(form.getByText("Taylor Desk can log in as desk employee.", { exact: false })).toBeVisible();
  temp = await form.locator("dd").nth(1).innerText();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row", { name: /Taylor Desk/ }).getByText("A4", { exact: true })).toBeVisible();

  // The code must be free.
  await page.getByRole("button", { name: "Add staff" }).click();
  await form.getByLabel("Role").selectOption("employee");
  await form.getByLabel("Name").fill("Someone Else");
  await form.getByLabel("Code").fill("A4");
  await form.getByLabel("Email", { exact: true }).fill("other@opengrowth.local");
  await form.getByLabel("Phone number").fill("555-000-0045");
  await form.getByRole("button", { name: "Create login" }).click();
  await expect(form.getByText("The code A4 is taken. Pick another.")).toBeVisible();
  await page.keyboard.press("Escape");
  await logout(page);

  await login(page, "a4@opengrowth.local", temp);
  await expect(page).toHaveURL("/desk");
});

test("reset password ends the old one; turning off blocks login until turned back on", async ({ page }) => {
  await login(page, "admin@opengrowth.local");
  await page.goto("/admin/staff");
  // Admin can't turn off or reset their own login here.
  await expect(page.getByRole("row", { name: /Owner/ }).getByRole("button")).toHaveCount(0);

  const row = page.getByRole("row", { name: /Taylor Desk/ });
  await row.getByRole("button", { name: "Reset password" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset Taylor Desk's password" });
  await dialog.getByRole("button", { name: "Reset password" }).click();
  await expect(dialog.getByText("Done. Their old password no longer works.")).toBeVisible();
  const fresh = await dialog.locator("dd").nth(1).innerText();
  expect(fresh).not.toBe(temp);
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "Turn off Taylor Desk" }).click();
  await expect(row.getByText("Turned off")).toBeVisible();
  await logout(page);

  await page.goto("/login");
  await page.getByLabel("Email").fill("a4@opengrowth.local");
  await page.getByLabel("Password", { exact: true }).fill(fresh);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("This account is not active. Message the team.")).toBeVisible();

  await login(page, "admin@opengrowth.local");
  await page.goto("/admin/staff");
  await page.getByRole("button", { name: "Turn on Taylor Desk" }).click();
  await expect(page.getByRole("row", { name: /Taylor Desk/ }).getByText("Active")).toBeVisible();
  await logout(page);
  await login(page, "a4@opengrowth.local", fresh);
  await expect(page).toHaveURL("/desk");
});

test("ops managers can't open Staff", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Staff" })).toHaveCount(0);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL("/ops");
});
