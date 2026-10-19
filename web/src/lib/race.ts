// The monthly Top 3 race: affiliates ranked by total gross profit (verified deposits − cashouts) from their
// referred players, 1st to last day of the month, New York time.
//
// - Flagged affiliates keep their place but their prize is ON HOLD until the flag is cleared.
// - Disqualified / inactive affiliates are left out, so the next affiliate moves up.
// - Every winner verifies ID before ops releases the prize.

import { db } from "./db";
import { RuleError } from "./errors";
import { getSettings } from "./settings";
import { localDay, zonedLocalToDate } from "./weeks";

export type Standing = {
  affiliateId: string;
  name: string;
  code: string | null;
  grossCents: bigint;
  rank: number;
  onHold: boolean;
  idVerified: boolean;
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthLabel(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

/** [start, end) of a race month as real instants. */
export function monthBounds(month: string) {
  return { start: zonedLocalToDate(`${month}T00:00`), end: zonedLocalToDate(`${nextMonth(month)}T00:00`) };
}

/** Live standings for a month (also used to settle the month when it ends). */
export async function standings(month: string): Promise<Standing[]> {
  const { start, end } = monthBounds(month);
  const sums = await db.transaction.groupBy({
    by: ["affiliateId", "type"],
    where: {
      status: "verified",
      affiliateId: { not: null },
      occurredAt: { gte: start, lt: end },
      player: { linkStatus: "confirmed" },
    },
    _sum: { amountCents: true },
  });
  const gross = new Map<string, bigint>();
  for (const s of sums) {
    const v = s._sum.amountCents ?? 0n;
    gross.set(s.affiliateId!, (gross.get(s.affiliateId!) ?? 0n) + (s.type === "deposit" ? v : -v));
  }
  const affiliates = await db.affiliate.findMany({
    where: { id: { in: [...gross.keys()] }, status: { in: ["active", "flagged"] } },
  });
  return affiliates
    .map((a) => ({
      affiliateId: a.id,
      name: a.legalName,
      code: a.referralCode,
      grossCents: gross.get(a.id) ?? 0n,
      onHold: a.status === "flagged",
      idVerified: a.idStatus === "verified",
    }))
    .filter((s) => s.grossCents > 0n)
    .sort((a, b) => (b.grossCents > a.grossCents ? 1 : b.grossCents < a.grossCents ? -1 : a.name.localeCompare(b.name)))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export async function prizeNames() {
  const s = await getSettings();
  return [s.prizes.first, s.prizes.second, s.prizes.third];
}

/** Settles a finished month: results are stored and the top 3 wait for ID check and release. */
export async function closeRaceMonth(month: string, now = new Date()) {
  if (month >= `${localDay(now).slice(0, 7)}-01`) throw new RuleError("This month hasn't ended yet.");
  const table = await standings(month);
  const [p1, p2, p3] = await prizeNames();
  return db.$transaction(async (tx) => {
    const existing = await tx.raceMonth.findUnique({ where: { month: new Date(`${month}T00:00:00Z`) } });
    if (existing && existing.status !== "live") return existing;
    const race = existing
      ? await tx.raceMonth.update({ where: { id: existing.id }, data: { status: "closed", prize1: p1, prize2: p2, prize3: p3 } })
      : await tx.raceMonth.create({ data: { month: new Date(`${month}T00:00:00Z`), status: "closed", prize1: p1, prize2: p2, prize3: p3 } });
    for (const s of table) {
      await tx.raceResult.create({
        data: {
          raceMonthId: race.id,
          affiliateId: s.affiliateId,
          grossProfitCents: s.grossCents,
          rank: s.rank,
          prizeStatus: s.rank <= 3 ? (s.onHold ? "on_hold" : "awaiting_id") : null,
        },
      });
    }
    await tx.auditLog.create({ data: { action: "race.close", entity: "race_month", entityId: race.id, after: { month, entries: table.length } } });
    return race;
  });
}

/** Settles any of the last three months that ended and isn't settled yet. Run by the worker. */
export async function closeDueRaceMonths(now = new Date()) {
  const current = `${localDay(now).slice(0, 7)}-01`;
  const closed = [];
  for (let m = prevMonth(prevMonth(prevMonth(current))); m < current; m = nextMonth(m)) {
    const race = await db.raceMonth.findUnique({ where: { month: new Date(`${m}T00:00:00Z`) } });
    if (race && race.status !== "live") continue;
    const { start, end } = monthBounds(m);
    const any = await db.transaction.count({ where: { status: "verified", occurredAt: { gte: start, lt: end } } });
    if (!any) continue;
    closed.push(await closeRaceMonth(m, now));
  }
  return closed;
}

/** Ops releases a prize: only to a winner whose ID is verified and who isn't flagged. */
export async function releasePrize(resultId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.raceResult.findUniqueOrThrow({ where: { id: resultId }, include: { affiliate: true } });
    if (!r.rank || r.rank > 3) throw new RuleError("Only the top 3 win a prize.");
    if (r.prizeStatus === "released") throw new RuleError("This prize was already released.");
    if (r.affiliate.status === "flagged") throw new RuleError("This affiliate has an open flag. Clear it before releasing the prize.");
    if (r.affiliate.idStatus !== "verified") throw new RuleError("Verify the winner's ID before releasing the prize.");
    await tx.raceResult.update({ where: { id: r.id }, data: { prizeStatus: "released" } });
    await tx.auditLog.create({ data: { actorId, action: "race.release_prize", entity: "race_result", entityId: r.id, after: { rank: r.rank } } });
  });
}
