import { expect, test } from "@playwright/test";
import path from "node:path";
import { login, logout } from "./helpers";
import { db } from "../src/lib/db";
import { statusBadge } from "../src/lib/affiliate-stats";
import { formatCents } from "../src/lib/money";
import { monthLabel, standings } from "../src/lib/race";
import { getSettings } from "../src/lib/settings";
import { localDay } from "../src/lib/weeks";

// Phase 5 exit check: an affiliate sees the same numbers ops sees for them.

const receipt = path.join(__dirname, "fixtures/receipt.png");
const fake = path.join(__dirname, "fixtures/fake.png");

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await db.$disconnect();
});

test("Affiliate 01's dashboard matches the mockup", async ({ page }) => {
  // The sample history sits "N weeks ago", but the badge (last month's payouts) and the race (this month)
  // follow the calendar, so their expected values are worked out for today's date.
  const a01 = await db.affiliate.findFirstOrThrow({ where: { legalName: "Affiliate 01" } });
  const badge = await statusBadge(a01.id, await getSettings());
  const table = await standings(`${localDay(new Date()).slice(0, 7)}-01`);
  const me = table.find((s) => s.affiliateId === a01.id);
  const gap = me && table[2] && me.rank > 3 ? table[2].grossCents - me.grossCents : null;

  await login(page, "affiliate01@opengrowth.local");
  await expect(page.getByText("STATUS")).toBeVisible();
  await expect(page.getByText(badge.name, { exact: true })).toBeVisible();

  const cards = page.getByRole("region", { name: "Key numbers" });
  await expect(cards.getByText("$71.00")).toBeVisible();
  await expect(cards.getByText("$38.00")).toBeVisible();
  await expect(cards.getByText(/^Paid Mon, [A-Z][a-z]{2} \d+/)).toBeVisible();
  await expect(cards.getByText("4", { exact: true })).toBeVisible(); // active players

  const race = page.getByLabel("Top 3 race");
  await expect(race.getByRole("heading")).toHaveText(
    !me ? "Get on the board this month." : gap === null ? `You're #${me.rank}. Hold your spot.` : `You're #${me.rank}. ${formatCents(gap, { whole: true })} behind 3rd place.`,
  );
  for (const s of table.slice(0, 3)) await expect(race.getByText(formatCents(s.grossCents, { whole: true })).first()).toBeVisible();

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
  await page.goto("/account");
  await page.getByRole("link", { name: /Upload your ID/ }).click();
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
  await expect(page.getByText("Thanks. Your ID is with the team for review.")).toBeVisible();
  await page.goto("/account");
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
  await page.goto("/account");
  await expect(page.getByText("ID verified")).toBeVisible();
  await expect(page.getByRole("link", { name: /Upload your ID/ })).toHaveCount(0);
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
  await page.goto("/account");
  await expect(page.getByText("ID rejected: upload again")).toBeVisible();
  await page.getByRole("link", { name: /Upload your ID/ }).click();
  await expect(page.getByText("Photo unreadable or cut off")).toBeVisible();
});

test("last month's prizes: release only to a verified, unflagged winner", async ({ page }) => {
  // Last month's winners depend on today's date (the sample data moves through the calendar).
  const race = await db.raceMonth.findFirstOrThrow({
    where: { status: { not: "live" } },
    orderBy: { month: "desc" },
    include: { results: { where: { rank: { lte: 3 } }, orderBy: { rank: "asc" }, include: { affiliate: true } } },
  });
  const winners = race.results.filter((r) => r.affiliate.status !== "flagged");
  expect(winners.length).toBeGreaterThan(1);
  // One winner with a verified ID (to release) and one without (to hold back).
  let ready = winners.find((r) => r.affiliate.idStatus === "verified");
  if (!ready) {
    ready = winners[winners.length - 1];
    await db.affiliate.update({ where: { id: ready.affiliateId }, data: { idStatus: "verified" } });
  }
  const waiting = winners.find((r) => r.id !== ready.id && r.affiliate.idStatus !== "verified");

  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/verification/prizes");
  const prizes = page.locator("#prizes");
  await expect(prizes.getByRole("heading")).toHaveText(`Top 3 prizes · ${monthLabel(race.month.toISOString().slice(0, 10))}`);
  if (waiting) {
    const row = prizes.getByRole("row", { name: new RegExp(waiting.affiliate.legalName) });
    await expect(row.getByText("Waiting for ID")).toBeVisible();
    await expect(row.getByRole("button")).toHaveCount(0);
  }
  const name = ready.affiliate.legalName;
  await expect(prizes.getByRole("row", { name: new RegExp(name) }).getByText("Ready to release")).toBeVisible();
  await prizes.getByRole("button", { name: `Release prize to ${name}` }).click();
  await expect(prizes.getByRole("row", { name: new RegExp(name) }).getByText("Released")).toBeVisible();
});

test("Verification lists who still needs an ID: this month's top 3", async ({ page }) => {
  await login(page, "ops@opengrowth.local");
  await page.goto("/ops/verification/needs-id");
  const checks = page.getByRole("region", { name: "Who still needs an ID" });
  // Whoever is top 3 today (the sample data moves through the calendar), each with its place and prize.
  const month = `${localDay(new Date()).slice(0, 7)}-01`;
  const top = (await standings(month)).slice(0, 3);
  expect(top.length).toBeGreaterThan(0);
  for (const [i, s] of top.entries()) {
    const row = checks.getByRole("row", { name: new RegExp(s.name) });
    await expect(row.getByText(`${monthLabel(month).split(" ")[0]} ${["1st", "2nd", "3rd"][i]} place:`, { exact: false })).toBeVisible();
    const a = await db.affiliate.findUniqueOrThrow({ where: { id: s.affiliateId } });
    if (a.status === "flagged") await expect(row.getByText("On hold: flagged")).toBeVisible();
  }
});
