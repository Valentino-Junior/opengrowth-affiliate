import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { login, logout } from "./helpers";

// Phase 3 exit check: a deposit logged by A1 and verified by A2 shows on the affiliate's live week.

const receipt = path.join(__dirname, "fixtures/receipt.png");
const fake = path.join(__dirname, "fixtures/fake.png");

/** The player field is a button that opens a centred list; pick from it like a person would. */
async function choosePlayer(page: Page, handle: string) {
  await page.locator("#log").getByRole("button", { name: /^Player handle/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a player" });
  await dialog.getByLabel("Search players").fill(handle);
  await dialog.getByRole("button", { name: new RegExp(`^${handle}\\b`) }).click();
  await expect(dialog).toBeHidden();
}

async function logEntry(page: Page, e: { type?: "Deposit" | "Cashout"; handle: string; amount: string; method: string; ref: string; file?: string }) {
  if (!page.url().endsWith("/desk/log")) await page.goto("/desk/log");
  const form = page.locator("#log form");
  if (e.type === "Cashout") await form.getByText("Cashout", { exact: true }).click();
  await choosePlayer(page, e.handle);
  await form.getByLabel("Amount (USD)").fill(e.amount);
  await form.getByLabel("Payment method").selectOption({ label: e.method });
  await form.getByLabel("Transaction ID / reference").fill(e.ref);
  await form.getByLabel("Payment screenshot").setInputFiles(e.file ?? receipt);
  await form.getByRole("button", { name: "Submit for verification" }).click();
  return form;
}

test("A1 logs, A2 verifies, Affiliate 01's live week goes up", async ({ page }) => {
  await login(page, "affiliate01@opengrowth.local");
  await expect(page.getByRole("region", { name: "Key numbers" }).getByText("$71.00")).toBeVisible(); // seeded: $1,420 gross × 5%
  await logout(page);

  await login(page, "a1@opengrowth.local");
  const form = await logEntry(page, { handle: "player13", amount: "250", method: "Venmo", ref: "VEN-777001" });
  await expect(form.getByText("Logged $250.00 deposit for player13. It's in the verify queue.")).toBeVisible();
  await page.goto("/desk/queue");
  const mine = page.locator("#queue").getByRole("row", { name: /player13.*\$250\.00/ });
  await expect(mine.getByText("Needs another teammate")).toBeVisible();
  await logout(page);

  await login(page, "a2@opengrowth.local");
  await page.goto("/desk/queue");
  await page.getByRole("link", { name: "Verify player13 deposit $250.00" }).click();
  await expect(page.getByRole("img", { name: /Payment screenshot for player13/ })).toBeVisible();
  // Box not ticked → refused.
  await page.getByRole("button", { name: "Verify entry" }).click();
  await expect(page.getByText("Tick the box once")).toBeVisible();
  await page.getByLabel(/match the screenshot/).check();
  await page.getByRole("button", { name: "Verify entry" }).click();
  await expect(page).toHaveURL(/\/desk\/queue$/);
  await expect(page.locator("#queue").getByRole("row", { name: /player13.*\$250\.00/ }).getByText("Verified")).toBeVisible();
  await logout(page);

  await login(page, "affiliate01@opengrowth.local");
  await expect(page.getByRole("region", { name: "Key numbers" }).getByText("$83.50")).toBeVisible();
  await expect(page.getByRole("region", { name: "How this week is calculated" }).getByText("$4,110")).toBeVisible(); // deposits $3,860 + $250 // ($1,420 + $250) × 5%
});

test("nobody can verify their own entry", async ({ page }) => {
  await login(page, "a3@opengrowth.local");
  await page.goto("/desk/queue");
  const row = page.locator("#queue").getByRole("row", { name: /player03.*\$600\.00/ });
  await expect(row.getByText("Needs another teammate")).toBeVisible();
  await expect(row.getByRole("link", { name: /Verify/ })).toHaveCount(0);
});

test("a rejection needs a reason and goes back to whoever logged it", async ({ page }) => {
  await login(page, "a2@opengrowth.local");
  await page.goto("/desk/queue");
  await page.getByRole("link", { name: "Verify player07 deposit $200.00" }).click();
  const reject = page.locator("#reject");
  await reject.getByLabel("Reason").selectOption("Wrong amount");
  await reject.getByRole("button", { name: "Reject entry" }).click();
  await expect(page).toHaveURL(/\/desk\/queue$/);
  await logout(page);

  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/log");
  const back = page.getByRole("heading", { name: "Sent back to you" }).locator("..");
  await expect(back.getByText("Wrong amount")).toBeVisible();
  await expect(back.getByRole("link", { name: "Fix and log again" })).toBeVisible();
  // Nothing to redo this time: dismiss it, and the box goes away.
  await back.getByRole("button", { name: /^Dismiss player07/ }).click();
  await expect(page.getByRole("heading", { name: "Sent back to you" })).toHaveCount(0);
});

test("a duplicate rejection can only be dismissed, never logged twice", async ({ page }) => {
  // player12's $450 cashout was logged by A2; A1 rejects it as a duplicate.
  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/queue");
  await page.getByRole("link", { name: "Verify player12 cashout $450.00" }).click();
  await page.locator("#reject").getByLabel("Reason").selectOption("Duplicate entry");
  await page.locator("#reject").getByRole("button", { name: "Reject entry" }).click();
  await logout(page);

  await login(page, "a2@opengrowth.local");
  await page.goto("/desk/log");
  const back = page.getByRole("heading", { name: "Sent back to you" }).locator("..");
  await expect(back.getByText("Duplicate entry")).toBeVisible();
  await expect(back.getByRole("link", { name: "Fix and log again" })).toHaveCount(0);
  await back.getByRole("button", { name: /^Dismiss player12/ }).click();
  await expect(page.getByRole("heading", { name: "Sent back to you" })).toHaveCount(0);
});

test("a payment reference can't be logged twice; a non-image is refused", async ({ page }) => {
  await login(page, "a1@opengrowth.local");
  let form = await logEntry(page, { handle: "player02", amount: "50", method: "Cash App", ref: "SEED-1000" });
  await expect(form.getByText("This transaction ID is already logged")).toBeVisible();
  form = await logEntry(page, { handle: "player02", amount: "50", method: "Crypto", ref: "NEW-REF-1", file: fake });
  await expect(form.getByText("Payment screenshot must be a PNG, JPG or WebP image.")).toBeVisible();
});

test("a player whose link isn't confirmed isn't offered for logging money", async ({ page }) => {
  await page.goto("/join/player?ref=OG-A04");
  await page.getByLabel("Player handle").fill("unconfirmed1");
  await page.getByLabel("Email").fill("unconfirmed1@example.com");
  await page.getByLabel("Phone number").fill("555-070-0001");
  await page.getByLabel("Pays with").selectOption("venmo");
  await page.getByLabel("Payment handle").fill("@unconfirmed1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("You're in.")).toBeVisible();

  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/log");
  await page.locator("#log").getByRole("button", { name: /^Player handle/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a player" });
  await dialog.getByLabel("Search players").fill("unconfirmed1");
  await expect(dialog.getByText("No player matches “unconfirmed1”.")).toBeVisible();
  // A confirmed player is offered.
  await dialog.getByLabel("Search players").fill("player13");
  await expect(dialog.getByRole("button", { name: /^player13\b/ })).toBeVisible();
});

test("only ops edits a verified entry, and the change is kept in history", async ({ page }) => {
  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/queue");
  await page.locator("#queue").getByRole("row", { name: /player21.*\$150\.00/ }).getByRole("link", { name: "View" }).click();
  await page.waitForURL(/\/desk\/entries\//);
  await expect(page.getByRole("heading", { name: "Edit verified entry" })).toHaveCount(0);
  const url = page.url();
  await logout(page);

  await login(page, "ops@opengrowth.local");
  await page.goto(url);
  await page.getByLabel("Amount (USD)").fill("175");
  await page.getByLabel("Why is it changing?").fill("Screenshot shows $175");
  await page.getByRole("button", { name: "Save change" }).click();
  await expect(page.getByText("Entry updated.")).toBeVisible();
  await expect(page.getByText("“Screenshot shows $175”")).toBeVisible();
  await expect(page.locator("s", { hasText: "$150.00" })).toBeVisible();
});

test("screenshots are private", async ({ page, request }) => {
  await login(page, "a1@opengrowth.local");
  await page.goto("/desk/queue");
  await page.locator("#queue").getByRole("row", { name: /player21/ }).getByRole("link", { name: "View" }).click();
  const src = await page.getByRole("img", { name: /Payment screenshot/ }).getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200);
  expect((await request.get(src!)).status()).toBe(404); // no session cookie
  expect((await request.get("/api/files/screenshots/../../.env")).status()).toBe(404);
});
