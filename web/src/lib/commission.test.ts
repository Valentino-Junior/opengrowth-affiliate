import { describe, expect, it } from "vitest";
import { badgeFor, computeWeek, type WeekInput } from "./commission";
import { DEFAULT_SETTINGS } from "./settings";
import { formatWeekRange, weekFor } from "./weeks";
import { dollarsToCents, formatCents } from "./money";

const base: Omit<WeekInput, "depositsCents" | "cashoutsCents"> = {
  carryInCents: 0n,
  rolledInCents: 0n,
  rateBp: 500,
  minPayoutCents: 1_000n,
  idThresholdCents: 50_000n,
  idVerified: true,
  flagged: false,
};

const $ = (d: number) => BigInt(Math.round(d * 100));

// Every case below is a row from the ops payout run or dashboard mockups.
describe("computeWeek — mockup numbers", () => {
  it("Affiliate 01: $3,000 gross, no carry → $150.00 ready", () => {
    const r = computeWeek({ ...base, depositsCents: $(7_450), cashoutsCents: $(4_450) });
    expect(r.grossProfitCents).toBe($(3_000));
    expect(r.commissionCents).toBe($(150));
    expect(r.status).toBe("ready");
  });

  it("Affiliate 02: $1,840 gross − $260 carried = $1,580 net → $79.00, carry cleared", () => {
    const r = computeWeek({ ...base, depositsCents: $(1_840), cashoutsCents: 0n, carryInCents: $(-260) });
    expect(r.netCents).toBe($(1_580));
    expect(r.commissionCents).toBe($(79));
    expect(r.carryOutCents).toBe(0n);
    expect(r.status).toBe("ready");
  });

  it("Affiliate 03: −$410 losing week → $0, carried forward", () => {
    const r = computeWeek({ ...base, depositsCents: $(1_000), cashoutsCents: $(1_410) });
    expect(r.commissionCents).toBe(0n);
    expect(r.carryOutCents).toBe($(-410));
    expect(r.status).toBe("carried");
  });

  it("Affiliate 04: $160 gross → $8.00, under the $10 minimum, rolls over", () => {
    const r = computeWeek({ ...base, depositsCents: $(160), cashoutsCents: 0n });
    expect(r.commissionCents).toBe($(8));
    expect(r.status).toBe("under_minimum");
    expect(r.rollOutCents).toBe($(8));
  });

  it("rolled-in $8 + next week's $4 = $12 → ready", () => {
    const r = computeWeek({ ...base, depositsCents: $(80), cashoutsCents: 0n, rolledInCents: $(8) });
    expect(r.payableCents).toBe($(12));
    expect(r.status).toBe("ready");
  });

  it("Affiliate 05: flagged account is held regardless of amount", () => {
    const r = computeWeek({ ...base, depositsCents: $(2_200), cashoutsCents: 0n, flagged: true });
    expect(r.commissionCents).toBe($(110));
    expect(r.status).toBe("flagged");
  });

  it("dashboard Oct 5: $2,460 profit − $320 carried → $107.00", () => {
    const r = computeWeek({ ...base, depositsCents: $(2_460), cashoutsCents: 0n, carryInCents: $(-320) });
    expect(r.commissionCents).toBe($(107));
  });

  it("a loss bigger than the week's profit keeps carrying (never resets)", () => {
    const r = computeWeek({ ...base, depositsCents: $(100), cashoutsCents: 0n, carryInCents: $(-500) });
    expect(r.commissionCents).toBe(0n);
    expect(r.carryOutCents).toBe($(-400));
    expect(r.status).toBe("carried");
  });

  it("payout over the ID threshold without ID → needs_id", () => {
    const r = computeWeek({ ...base, depositsCents: $(20_000), cashoutsCents: 0n, idVerified: false });
    expect(r.payableCents).toBe($(1_000));
    expect(r.status).toBe("needs_id");
  });

  it("rounds commission down to the cent", () => {
    const r = computeWeek({ ...base, depositsCents: 1_999n, cashoutsCents: 0n }); // $19.99 × 5% = 99.95¢
    expect(r.commissionCents).toBe(99n);
  });
});

describe("badgeFor", () => {
  const t = DEFAULT_SETTINGS.badgeThresholds;
  it("picks the highest reached threshold", () => {
    expect(badgeFor(0n, t)).toBe("Builder");
    expect(badgeFor($(149.99), t)).toBe("Hustler");
    expect(badgeFor($(1_000), t)).toBe("Kingpin");
    expect(badgeFor($(5_000), t)).toBe("OG Status");
  });
});

describe("weekFor (America/New_York)", () => {
  it("Sunday 23:59 local is still the same week; Monday 00:00 starts the next", () => {
    expect(weekFor(new Date("2026-10-19T03:59:00Z")).startsOn).toBe("2026-10-12"); // Sun Oct 18, 23:59 EDT
    expect(weekFor(new Date("2026-10-19T04:00:00Z")).startsOn).toBe("2026-10-19"); // Mon Oct 19, 00:00 EDT
  });
  it("pays the following Monday and formats like the mockups", () => {
    const w = weekFor(new Date("2026-10-14T12:00:00Z"));
    expect(w).toEqual({ startsOn: "2026-10-12", endsOn: "2026-10-18", payoutDate: "2026-10-19" });
    expect(formatWeekRange(w)).toBe("Oct 12–18");
  });
});

describe("money", () => {
  it("parses and formats dollars", () => {
    expect(dollarsToCents("1,580.5")).toBe(158_050n);
    expect(() => dollarsToCents("-5")).toThrow();
    expect(formatCents(-26_000n)).toBe("−$260.00");
  });
});

describe("zonedLocalToDate (America/New_York)", () => {
  it("reads typed wall-clock times as New York time, across DST", async () => {
    const { zonedLocalToDate, dateToZonedLocal } = await import("./weeks");
    expect(zonedLocalToDate("2026-10-19T10:42").toISOString()).toBe("2026-10-19T14:42:00.000Z"); // EDT, UTC−4
    expect(zonedLocalToDate("2026-12-01T10:42").toISOString()).toBe("2026-12-01T15:42:00.000Z"); // EST, UTC−5
    expect(dateToZonedLocal(new Date("2026-10-19T14:42:00Z"))).toBe("2026-10-19T10:42");
  });
});
