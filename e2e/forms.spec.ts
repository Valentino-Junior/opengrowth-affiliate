import { expect, test } from "@playwright/test";

// Form feedback: show/hide password, and clear messages instead of browser pop-ups.

test("the eye button shows and hides the password", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("secret-123");
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("secret-123");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("an email without @ is flagged on submit and nothing is sent", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Email");
  await email.fill("affiliate01opengrowth.local");
  await page.getByLabel("Password", { exact: true }).fill("opengrowth");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toBeFocused();
  await expect(page).toHaveURL("/login");

  // Fixing it clears the message as you type, and the login goes through.
  await email.fill("affiliate01@opengrowth.local");
  await expect(page.getByText("Enter a valid email address")).toHaveCount(0);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("an email with @ but no domain (name@site) is flagged too", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Email").fill("casey@example");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible();
  await expect(page).toHaveURL("/join");
});

test("empty and too-short fields get their own messages", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Enter email.")).toBeVisible();
  await expect(page.getByText("Enter password.")).toBeVisible();

  await page.goto("/join");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByText("Password: at least 8 characters.")).toBeVisible();
});
