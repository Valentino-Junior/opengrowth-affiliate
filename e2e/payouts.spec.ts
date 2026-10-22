import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

// Phase 4 exit check: one full Monday run on the mockup data matches the hand calculation to the cent.

test.describe.configure({ mode: "serial" });

test("close last week → the run matches the ops mockup", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/payouts");
  const close = page.getByRole("button", { name: "Close week now" });
  if (await close.count()) await close.click(); // another spec may have closed it already
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Week of/);

  const summary = page.getByRole("region", { name: "Run summary" });
  await expect(summary.getByText("$9,750")).toBeVisible();
  await expect(summary.getByText("$377.00")).toBeVisible();

  const expectRow = async (name: string, cells: string[], status: string) => {
    const row = page.getByRole("row", { name: new RegExp(name) });
    for (const c of cells) await expect(row.getByText(c, { exact: true }).first()).toBeVisible();
    await expect(row.getByText(status, { exact: true })).toBeVisible();
  };
  await expectRow("Affiliate 01", ["$3,000", "$150.00"], "Ready");
  await expectRow("Affiliate 02", ["$1,840", "−$260", "$1,580", "$79.00"], "Ready");
  await expectRow("Affiliate 03", ["−$410", "$0.00"], "Carried");
  await expectRow("Affiliate 04", ["$160", "$8.00"], "Under minimum");
  await expectRow("Affiliate 05", ["$2,200", "$110.00"], "Flagged");
  await expectRow("Affiliate 06", ["$2,960", "$148.00"], "Ready");
  await expect(page.getByText("Affiliate 05 is on hold: payment handle matches the affiliate (player player24). Review the flag before paying.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close week now" })).toHaveCount(0);
});

test("mark paid asks to confirm, then the row is paid", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/payouts");
  await page.getByRole("button", { name: "Mark Affiliate 01 paid" }).click();
  await expect(page.getByText("Sent $150.00 to Affiliate 01 by Cash App (affiliate01)?")).toBeVisible();
  await page.getByLabel("Payment reference").fill("CA-TEST-1");
  await page.getByRole("button", { name: "Confirm $150.00" }).click();
  const row = page.getByRole("row", { name: /Affiliate 01/ });
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();
  await expect(row.getByText(/CA-TEST-1/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Run summary" }).getByText("$227.00")).toBeVisible();
  await expect(page.getByText("$150.00 already paid")).toBeVisible();
});

test("export payout list as CSV", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/payouts");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export payout list" }).click()]);
  const csv = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  expect(csv.split("\n")[0]).toBe("Affiliate,Code,Method,Payout handle,Gross profit,Carry-forward,Net,Commission,Rolled in,Pay,Status,Paid at,Payment ref");
  expect(csv).toContain("Affiliate 02,OG-A02,Crypto,affiliate02,1840.00,-260.00,1580.00,79.00,0.00,79.00,ready,,");
  expect(csv).toMatch(/Affiliate 01,OG-A01,Cash App,affiliate01,3000\.00,0\.00,3000\.00,150\.00,0\.00,150\.00,paid,.+,CA-TEST-1/);
});

test("clearing the flag releases Affiliate 05's $110", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/payouts");
  await page.getByRole("row", { name: /Affiliate 05/ }).getByRole("link", { name: "Review" }).click();
  await page.getByRole("row", { name: /player24/ }).getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("row", { name: /player24/ }).getByText("Cleared")).toBeVisible();
  await page.goto("/ops/payouts");
  await expect(page.getByRole("row", { name: /Affiliate 05/ }).getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Run summary" }).getByText("$337.00")).toBeVisible(); // 79 + 110 + 148
});

test("the manual checklist item ticks and unticks", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/payouts");
  const item = page.getByRole("listitem").filter({ hasText: "Payouts sent by each affiliate's method" });
  await expect(item.getByText("(not done)")).toBeAttached();
  await item.getByRole("button", { name: "Tick" }).click();
  await expect(item.getByText("(done)")).toBeAttached();
  await item.getByRole("button", { name: "Undo" }).click();
  await expect(item.getByText("(not done)")).toBeAttached();
});

test("employees can't open the run or the export", async ({ page }) => {
  await login(page, "a1@opengrowth.local");
  await page.goto("/ops/payouts");
  await expect(page).toHaveURL("/desk");
  const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  expect((await page.request.get(`/ops/payouts/export?week=${week}`)).status()).toBe(404);
  await logout(page);
});
