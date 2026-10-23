import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { login, logout } from "./helpers";

// The bell: a rejected entry notifies whoever logged it; opening the notification goes to the fix and clears the count.

const bell = (page: Page) => page.getByRole("button", { name: /^Notifications/ });

const receipt = path.join(__dirname, "fixtures/receipt.png");

test("a rejection rings the logger's bell; it opens the pre-filled fix; submitting the correction clears it", async ({ page }) => {
  // A1 logs an entry with the wrong amount.
  await login(page, "a1@opengrowth.local");
  await expect(bell(page)).toHaveAccessibleName("Notifications");
  await page.goto("/desk/log");
  await page.locator("#log").getByRole("button", { name: /^Player handle/ }).click();
  const picker = page.getByRole("dialog", { name: "Choose a player" });
  await picker.getByLabel("Search players").fill("player02");
  await picker.getByRole("button", { name: /^player02\b/ }).click();
  const form = page.locator("#log form");
  await form.getByLabel("Amount (USD)").fill("80");
  await form.getByLabel("Payment method").selectOption({ label: "Crypto" });
  await form.getByLabel("Transaction ID / reference").fill("BELL-FIX-1");
  await form.getByLabel("Payment screenshot").setInputFiles(receipt);
  await form.getByRole("button", { name: "Submit for verification" }).click();
  await expect(form.getByText("Logged $80.00 deposit for player02.")).toBeVisible();
  await logout(page);

  // A2 rejects it.
  await login(page, "a2@opengrowth.local");
  await page.goto("/desk/queue");
  await page.getByRole("link", { name: "Verify player02 deposit $80.00" }).click();
  await page.locator("#reject").getByLabel("Reason").selectOption("Wrong amount");
  await page.locator("#reject").getByRole("button", { name: "Reject entry" }).click();
  await expect(page).toHaveURL("/desk/queue");
  await logout(page);

  // A1's bell rings; the notification opens the form already filled in.
  await login(page, "a1@opengrowth.local");
  await expect(bell(page)).toHaveAccessibleName("Notifications, 1 unread");
  await bell(page).click();
  const item = page.getByRole("dialog", { name: "Notifications" }).getByRole("button", { name: /Your \$80\.00 deposit for player02 was rejected/ });
  await expect(item).toContainText("Reason: Wrong amount.");
  await item.click();
  await expect(page).toHaveURL(/\/desk\/log\?fix=/);
  await expect(page.getByText(/Fixing the rejected \$80\.00 deposit for player02/)).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName("Notifications");
  const fix = page.locator("#log form");
  await expect(fix.getByLabel("Amount (USD)")).toHaveValue("80.00");
  await expect(fix.getByLabel("Transaction ID / reference")).toHaveValue("BELL-FIX-1");
  await expect(page.locator("#log").getByRole("button", { name: /^Player handle/ })).toContainText("player02");

  // Correct it and submit: it leaves Sent back to you, and the verifier sees it marked as a correction.
  await fix.getByLabel("Amount (USD)").fill("85");
  await fix.getByLabel("Payment screenshot").setInputFiles(receipt);
  await fix.getByRole("button", { name: "Submit the correction" }).click();
  await expect(page).toHaveURL(/\/desk\/log\?corrected=/);
  await expect(page.getByText("Correction logged: $85.00 deposit for player02.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sent back to you" })).toHaveCount(0);
  await page.goto("/desk/queue");
  await expect(page.locator("#queue").getByRole("row", { name: /player02.*\$85\.00/ }).getByText("Correction")).toBeVisible();
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
