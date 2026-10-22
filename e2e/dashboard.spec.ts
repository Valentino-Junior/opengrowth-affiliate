import { expect, test } from "@playwright/test";
import path from "node:path";
import { login, logout } from "./helpers";

// Phase 5 exit check: an affiliate sees the same numbers ops sees for them.

const receipt = path.join(__dirname, "fixtures/receipt.png");
const fake = path.join(__dirname, "fixtures/fake.png");

test.describe.configure({ mode: "serial" });

test("Affiliate 01's dashboard matches the mockup", async ({ page }) => {
  await login(page, "affiliate01@opengrowth.local");
  await expect(page.getByText("STATUS")).toBeVisible();
  await expect(page.getByText("Hustler")).toBeVisible(); // $94 paid in September ≥ $50

  const cards = page.getByRole("region", { name: "Key numbers" });
  await expect(cards.getByText("$71.00")).toBeVisible();
  await expect(cards.getByText("$38.00")).toBeVisible();
  await expect(cards.getByText(/^Paid Mon, Oct/)).toBeVisible();
  await expect(cards.getByText("4", { exact: true })).toBeVisible(); // active players

  const race = page.getByLabel("Top 3 race");
  await expect(race.getByRole("heading")).toHaveText("You're #4. $1,130 behind 3rd place.");
  await expect(race.getByText("$9,860")).toBeVisible();
  await expect(race.getByText("$5,180")).toBeVisible();

  const history = page.getByLabel("Payout history");
  await expect(history.getByText("$2,460 profit − $320 carried")).toBeVisible();
  await expect(history.getByText("$107.00")).toBeVisible();
  await expect(history.getByText("−$320 losing week")).toBeVisible();
  await expect(history.getByText("Carried forward")).toBeVisible();

  const players = page.getByLabel("My players this week");
  await expect(players.getByRole("row", { name: /player07/ }).getByText("+$250")).toBeVisible(); // 950 − 700
  await expect(players.getByRole("row", { name: /player19/ }).getByText("−$230")).toBeVisible(); // 1,110 − 1,340
});

test("My players: pick an earlier week", async ({ page }) => {
  await login(page, "affiliate01@opengrowth.local");
  await page.goto("/dashboard/players");
  await page.getByRole("navigation", { name: "Week" }).getByRole("link").nth(1).click();
  await expect(page.getByText("$7,450 deposits − $4,450 cashouts = $3,000")).toBeVisible(); // the mockup's example week
});

test("ID upload refuses a non-image, then goes to ops review", async ({ page }) => {
  await login(page, "affiliate04@opengrowth.local");
  await page.getByRole("link", { name: "Verify my ID" }).click();
  await page.getByLabel("Photo of the front of your ID").setInputFiles(fake);
  await page.getByLabel("Selfie holding the ID").setInputFiles(receipt);
  await page.getByLabel(/This is my own ID/).check();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Photo of the ID must be a PNG, JPG or WebP image.")).toBeVisible();

  await page.getByLabel("Photo of the front of your ID").setInputFiles(receipt);
  await page.getByLabel("Selfie holding the ID").setInputFiles(receipt);
  await page.getByLabel(/This is my own ID/).check();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page).toHaveURL(/\/dashboard\?id=submitted/);
  await expect(page.getByText("ID being checked")).toBeVisible();
  await logout(page);

  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/verification");
  const doc = page.getByLabel("ID for Affiliate 04");
  await expect(doc.getByText("Matches", { exact: true })).toBeVisible();
  await doc.getByRole("button", { name: "Approve ID" }).click();
  await expect(doc.getByText("Tick the box once the name on the ID matches the account.")).toBeVisible();
  await doc.getByLabel("Name on the ID matches the account").check();
  await doc.getByRole("button", { name: "Approve ID" }).click();
  await expect(page.getByLabel("ID for Affiliate 04")).toHaveCount(0);
  await logout(page);

  await login(page, "affiliate04@opengrowth.local");
  await expect(page.getByText("ID verified")).toBeVisible();
  await expect(page.getByRole("link", { name: "Verify my ID" })).toHaveCount(0);
});

test("ops rejects an ID with a reason; the affiliate sees it and can upload again", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/verification");
  const doc = page.getByLabel("ID for Affiliate 06");
  await doc.getByLabel(/Reason to reject/).selectOption("Photo unreadable or cut off");
  await doc.getByRole("button", { name: "Reject ID" }).click();
  await expect(page.getByLabel("ID for Affiliate 06")).toHaveCount(0);
  await logout(page);

  await login(page, "affiliate06@opengrowth.local");
  await expect(page.getByText("ID rejected: upload again")).toBeVisible();
  await page.getByRole("link", { name: "Verify my ID" }).click();
  await expect(page.getByText("Photo unreadable or cut off")).toBeVisible();
});

test("September prizes: release only to a verified, unflagged winner", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/verification");
  const prizes = page.locator("#prizes");
  await expect(prizes.getByRole("heading")).toHaveText("Top 3 prizes · September 2026");
  await expect(prizes.getByRole("row", { name: /Affiliate 06/ }).getByText("Waiting for ID")).toBeVisible();
  await expect(prizes.getByRole("row", { name: /Affiliate 06/ }).getByRole("button")).toHaveCount(0);
  const third = prizes.getByRole("row", { name: /Affiliate 02/ });
  await expect(third.getByText("Ready to release")).toBeVisible();
  await third.getByRole("button", { name: "Release prize to Affiliate 02" }).click();
  await expect(prizes.getByRole("row", { name: /Affiliate 02/ }).getByText("Released")).toBeVisible();
});

test("payout run lists ID checks for this month's top 3", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/payouts");
  const close = page.getByRole("button", { name: "Close week now" });
  if (await close.count()) await close.click(); // another spec may have closed it already
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Week of/);
  const checks = page.getByLabel("ID checks before release");
  await expect(checks.getByRole("row", { name: /Affiliate 06/ }).getByText("October 1st place: car")).toBeVisible();
  await expect(checks.getByRole("row", { name: /Affiliate 05/ }).getByText("On hold: flagged")).toBeVisible();
});
