// Numbers for the affiliate's own dashboard. Every figure is scoped to one affiliate.

import { badgeFor } from "./commission";
import { db } from "./db";
import { prevMonth } from "./race";
import type { Settings } from "./settings";
import { localDay, type WeekBounds } from "./weeks";

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Status badge from what was paid out last calendar month. */
export async function statusBadge(affiliateId: string, settings: Settings, now = new Date()) {
  const thisMonth = `${localDay(now).slice(0, 7)}-01`;
  const last = prevMonth(thisMonth);
  const rows = await db.affiliateWeek.findMany({
    where: { affiliateId, status: "paid", week: { payoutDate: { gte: asDate(last), lt: asDate(thisMonth) } } },
    select: { payableCents: true },
  });
  const earned = rows.reduce((t, r) => t + r.payableCents, 0n);
  return { name: badgeFor(earned, settings.badgeThresholds), earnedCents: earned };
}

export async function lastPayout(affiliateId: string) {
  return db.affiliateWeek.findFirst({
    where: { affiliateId, status: "paid" },
    orderBy: { week: { startsOn: "desc" } },
    include: { week: true },
  });
}

/** Players with a verified deposit in the last 30 days. */
export async function activePlayerCount(affiliateId: string, now = new Date()) {
  const players = await db.transaction.findMany({
    where: {
      affiliateId,
      type: "deposit",
      status: "verified",
      occurredAt: { gte: new Date(now.getTime() - 30 * 864e5) },
      player: { linkStatus: "confirmed", affiliateId },
    },
    distinct: ["playerId"],
    select: { playerId: true },
  });
  return players.length;
}

export type PlayerWeekRow = { id: string; handle: string; joined: Date; depositsCents: bigint; cashoutsCents: bigint; grossCents: bigint };

/** Each confirmed player's verified deposits / cashouts in one week, biggest gross profit first. */
export async function playersForWeek(affiliateId: string, bounds: WeekBounds): Promise<PlayerWeekRow[]> {
  const week = await db.week.findUnique({ where: { startsOn: asDate(bounds.startsOn) } });
  const [players, sums] = await Promise.all([
    db.player.findMany({ where: { affiliateId, linkStatus: "confirmed" }, orderBy: { handle: "asc" } }),
    week
      ? db.transaction.groupBy({
          by: ["playerId", "type"],
          where: { affiliateId, weekId: week.id, status: "verified" },
          _sum: { amountCents: true },
        })
      : Promise.resolve([]),
  ]);
  const get = (playerId: string, type: "deposit" | "cashout") =>
    sums.find((s) => s.playerId === playerId && s.type === type)?._sum.amountCents ?? 0n;
  return players
    .map((p) => {
      const d = get(p.id, "deposit");
      const c = get(p.id, "cashout");
      return { id: p.id, handle: p.handle, joined: p.linkConfirmedAt ?? p.createdAt, depositsCents: d, cashoutsCents: c, grossCents: d - c };
    })
    .sort((a, b) => (b.grossCents > a.grossCents ? 1 : b.grossCents < a.grossCents ? -1 : a.handle.localeCompare(b.handle)));
}

export async function payoutHistory(affiliateId: string, take?: number) {
  return db.affiliateWeek.findMany({
    where: { affiliateId },
    orderBy: { week: { startsOn: "desc" } },
    include: { week: true },
    take,
  });
}
