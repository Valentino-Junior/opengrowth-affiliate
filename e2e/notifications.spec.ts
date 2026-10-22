import { expect, test, type Page } from "@playwright/test";
import { login, logout } from "./helpers";

// The bell: a rejected entry notifies whoever logged it; opening the notification goes to the fix and clears the count.

const bell = (page: Page) => page.getByRole("button", { name: /^Notifications/ });

test("a rejection rings the logger's bell; opening it leads to the fix and clears the count", async ({ page }) => {
  await login(page, "a1@opengrowth.local");
  await expect(bell(page)).toHaveAccessibleName("Notifications");
  await logout(page);

  await login(page, "a2@opengrowth.local");
  await page.goto("/desk/queue");
  await page.getByRole("link", { name: "Verify player07 deposit $200.00" }).click();
  await page.locator("#reject").getByLabel("Reason").selectOption("Wrong amount");
  await page.locator("#reject").getByRole("button", { name: "Reject entry" }).click();
  await expect(page).toHaveURL("/desk/queue");
  await logout(page);

  await login(page, "a1@opengrowth.local");
  await expect(bell(page)).toHaveAccessibleName("Notifications, 1 unread");
  await bell(page).click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  const item = panel.getByRole("button", { name: /Your \$200\.00 deposit for player07 was rejected/ });
  await expect(item).toContainText("Reason: Wrong amount.");
  await item.click();
  await expect(page).toHaveURL("/desk/log");
  await expect(page.getByRole("heading", { name: "Sent back to you" })).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName("Notifications");
});

test("ops hear about new affiliate signups; Mark all as read clears them", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Full legal name").fill("Bell Tester");
  await page.getByLabel("Email").fill("bell-tester@example.com");
  await page.getByLabel("Phone number").fill("555-090-0001");
  await page.getByLabel("Password", { exact: true }).fill("bell-tester-pw");
  await page.getByLabel("Get paid by").selectOption("cash_app");
  await page.getByLabel("Payout handle").fill("$belltester");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL("/verify-email");
  await page.getByRole("link", { name: "Do this later" }).click();
  await logout(page);

  await login(page, "ops@opengrowth.local");
  await bell(page).click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("Bell Tester signed up as an affiliate")).toBeVisible();
  await panel.getByRole("button", { name: "Mark all as read" }).click();
  await expect(bell(page)).toHaveAccessibleName("Notifications");
});
