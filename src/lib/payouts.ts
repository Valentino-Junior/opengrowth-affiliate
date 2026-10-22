// The weekly close and the Monday payout run.
//
// Close (Sunday 23:59 → runs from Monday 00:00 New York time):
//   1. The week is frozen with the settings in force (rate, minimum, ID threshold).
//   2. One affiliate_weeks row per affiliate: verified deposits − cashouts, carry-in, rolled-in, commission.
//   3. Each affiliate's carry-forward balance becomes that week's carry-out.
// Payout run (ops, Monday): pay the "ready" rows by hand and mark them paid; flagged / needs-ID rows wait.

import type { Affiliate, AffiliateWeek, Prisma, Week } from "@prisma/client";
import { computeWeek } from "./commission";
import { db } from "./db";
import { RuleError } from "./errors";
import { getSettings, type Settings } from "./settings";
import { countableFor, getOrCreateWeek } from "./transactions";
import { formatWeekRange, localDay, weekFor } from "./weeks";
import { formatCents } from "./money";
import { MANAGEMENT, notifyRoles } from "./notifications";

type Tx = Prisma.TransactionClient;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function weekTotals(tx: Tx, affiliateId: string, weekId: string) {
  const sums = await tx.transaction.groupBy({
    by: ["type"],
    where: countableFor(affiliateId, weekId),
    _sum: { amountCents: true },
  });
  const sum = (t: "deposit" | "cashout") => sums.find((s) => s.type === t)?._sum.amountCents ?? 0n;
  return { depositsCents: sum("deposit"), cashoutsCents: sum("cashout") };
}

/** Commission still owed from the affiliate's previous row when it was under the minimum. */
async function rolledInFor(tx: Tx, affiliateId: string, before: Date): Promise<bigint> {
  const prev = await tx.affiliateWeek.findFirst({
    where: { affiliateId, week: { startsOn: { lt: before } } },
    orderBy: { week: { startsOn: "desc" } },
  });
  return prev?.status === "under_minimum" ? prev.payableCents : 0n;
}

function frozen(week: Week, s: Settings) {
  return {
    rateBp: week.rateBp ?? s.commissionRateBp,
    minPayoutCents: week.minPayoutCents ?? BigInt(s.minPayoutCents),
    idThresholdCents: week.idThresholdCents ?? BigInt(s.idThresholdCents),
  };
}

function rowFields(
  totals: { depositsCents: bigint; cashoutsCents: bigint },
  carryInCents: bigint,
  rolledInCents: bigint,
  affiliate: Affiliate,
  rules: ReturnType<typeof frozen>,
) {
  const r = computeWeek({
    ...totals,
    carryInCents,
    rolledInCents,
    ...rules,
    idVerified: affiliate.idStatus === "verified",
    flagged: affiliate.status === "flagged" || affiliate.status === "disqualified",
  });
  return {
    depositsCents: totals.depositsCents,
    cashoutsCents: totals.cashoutsCents,
    grossProfitCents: r.grossProfitCents,
    carryInCents,
    netCents: r.netCents,
    commissionCents: r.commissionCents,
    rolledInCents,
    payableCents: r.payableCents,
    carryOutCents: r.carryOutCents,
    status: r.status,
  };
}

/** Closes one finished week and builds its payout rows. Safe to call twice: the second call is refused. */
export async function closeWeek(weekId: string, actorId: string | null, now = new Date()) {
  const settings = await getSettings();
  return db.$transaction(
    async (tx) => {
      const week = await tx.week.findUniqueOrThrow({ where: { id: weekId } });
      if (week.status !== "open") throw new RuleError("This week is already closed.");
      if (ymd(week.endsOn) >= localDay(now)) throw new RuleError("This week hasn't ended yet. It closes after Sunday 23:59.");

      const { count } = await tx.week.updateMany({
        where: { id: week.id, status: "open" },
        data: {
          status: "closed",
          closedAt: now,
          closedBy: actorId,
          rateBp: settings.commissionRateBp,
          minPayoutCents: BigInt(settings.minPayoutCents),
          idThresholdCents: BigInt(settings.idThresholdCents),
        },
      });
      if (count === 0) throw new RuleError("This week is already closed.");
      const closed = await tx.week.findUniqueOrThrow({ where: { id: week.id } });
      const rules = frozen(closed, settings);

      const affiliates = await tx.affiliate.findMany({ where: { referralCode: { not: null } } });
      let rows = 0;
      for (const a of affiliates) {
        const totals = await weekTotals(tx, a.id, week.id);
        const rolledIn = await rolledInFor(tx, a.id, week.startsOn);
        const carryIn = a.carryForwardCents;
        // Nothing happened and nothing is owed either way: no row.
        if (!totals.depositsCents && !totals.cashoutsCents && !carryIn && !rolledIn) continue;

        const playerCount = await tx.player.count({ where: { affiliateId: a.id, linkStatus: "confirmed" } });
        const fields = rowFields(totals, carryIn, rolledIn, a, rules);
        await tx.affiliateWeek.create({ data: { weekId: week.id, affiliateId: a.id, playerCount, ...fields } });
        await tx.affiliate.update({ where: { id: a.id }, data: { carryForwardCents: fields.carryOutCents } });
        rows++;
      }

      await tx.auditLog.create({
        data: { actorId, action: "week.close", entity: "week", entityId: week.id, after: { rows, ...stringify(rules) } },
      });
      return { week: closed, rows };
    },
    { timeout: 60_000 },
  );
}

/** Closes every finished week that is still open. Run by the worker every minute and by "Close week now". */
export async function closeDueWeeks(now = new Date()) {
  // Make sure last week exists even if nothing was verified in it, so carry-forwards and roll-overs still run.
  await db.$transaction((tx) => getOrCreateWeek(tx, weekFor(new Date(now.getTime() - 7 * 864e5))));
  const due = await db.week.findMany({
    where: { status: "open", endsOn: { lt: new Date(`${localDay(now)}T00:00:00Z`) } },
    orderBy: { startsOn: "asc" },
  });
  const closed = [];
  for (const w of due) {
    const c = await closeWeek(w.id, null, now);
    closed.push(c);
    const ready = await db.affiliateWeek.aggregate({ where: { weekId: c.week.id, status: "ready" }, _sum: { payableCents: true }, _count: true });
    await notifyRoles(MANAGEMENT, {
      kind: "week_closed",
      title: `Week of ${formatWeekRange({ startsOn: ymd(c.week.startsOn), endsOn: ymd(c.week.endsOn) })} closed`,
      body: `${ready._count} payout${ready._count === 1 ? "" : "s"} ready, ${formatCents(ready._sum.payableCents ?? 0n)} to send.`,
      href: "/ops/payouts",
    });
  }
  return closed;
}

/**
 * Re-evaluates rows on hold (flagged / needs ID) after ops clears a flag, disqualifies a player or approves an ID.
 * Totals are recounted so a disqualified player's money drops out.
 */
export async function refreshHeldRows(weekId: string) {
  const settings = await getSettings();
  await db.$transaction(async (tx) => {
    const week = await tx.week.findUniqueOrThrow({ where: { id: weekId } });
    const held = await tx.affiliateWeek.findMany({
      where: { weekId, status: { in: ["flagged", "needs_id"] } },
      include: { affiliate: true },
    });
    for (const row of held) {
      const totals = await weekTotals(tx, row.affiliateId, weekId);
      const fields = rowFields(totals, row.carryInCents, row.rolledInCents, row.affiliate, frozen(week, settings));
      if (fields.status === row.status && fields.payableCents === row.payableCents) continue;
      await tx.affiliateWeek.update({ where: { id: row.id }, data: fields });
      // Keep the running carry-forward right when this is the affiliate's latest week.
      const later = await tx.affiliateWeek.count({ where: { affiliateId: row.affiliateId, week: { startsOn: { gt: week.startsOn } } } });
      if (!later) await tx.affiliate.update({ where: { id: row.affiliateId }, data: { carryForwardCents: fields.carryOutCents } });
    }
  });
}

/** Refreshes every week that has rows on hold. Called after any flag or ID decision. */
export async function refreshAllHeldRows() {
  const weeks = await db.affiliateWeek.findMany({
    where: { status: { in: ["flagged", "needs_id"] } },
    select: { weekId: true },
    distinct: ["weekId"],
  });
  for (const w of weeks) await refreshHeldRows(w.weekId);
}

/** Ops marks a ready row as paid after sending the money by the affiliate's method. */
export async function markPaid(rowId: string, actorId: string, paymentRef: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.affiliateWeek.findUniqueOrThrow({ where: { id: rowId }, include: { affiliate: true, week: true } });
    if (row.status !== "ready") throw new RuleError("Only rows marked Ready can be paid.");
    if (row.affiliate.status === "flagged") throw new RuleError("This affiliate has an open flag. Review it first.");
    const threshold = row.week.idThresholdCents ?? 0n;
    if (row.payableCents > threshold && row.affiliate.idStatus !== "verified")
      throw new RuleError("This payout is over the ID-check amount and the affiliate's ID isn't verified.");

    const { count } = await tx.affiliateWeek.updateMany({
      where: { id: row.id, status: "ready" },
      data: { status: "paid", paidAt: new Date(), paidBy: actorId, paymentRef: paymentRef.trim() || null },
    });
    if (count === 0) throw new RuleError("Someone else already marked this paid.");

    const open = await tx.affiliateWeek.count({ where: { weekId: row.weekId, status: { in: ["ready", "flagged", "needs_id"] } } });
    if (!open) await tx.week.update({ where: { id: row.weekId }, data: { status: "paid" } });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "payout.mark_paid",
        entity: "affiliate_week",
        entityId: row.id,
        after: { affiliate: row.affiliate.referralCode, payableCents: String(row.payableCents), method: row.affiliate.payoutMethod, paymentRef },
      },
    });
  });
}

export const MANUAL_CHECKS = ["payouts_sent"] as const;

export async function setChecklistItem(weekId: string, item: (typeof MANUAL_CHECKS)[number], done: boolean, actorId: string) {
  const week = await db.week.findUniqueOrThrow({ where: { id: weekId } });
  const checklist = { ...(week.checklist as Record<string, boolean>), [item]: done };
  await db.week.update({ where: { id: weekId }, data: { checklist } });
  await db.auditLog.create({ data: { actorId, action: "week.checklist", entity: "week", entityId: weekId, after: { item, done } } });
}

export type PayoutRow = AffiliateWeek & { affiliate: Affiliate };

/** CSV for the payout list: what ops needs to send each payment. */
export function payoutCsv(rows: PayoutRow[], methodLabel: (m: Affiliate["payoutMethod"]) => string): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const money = (c: bigint) => (Number(c) / 100).toFixed(2);
  const header = ["Affiliate", "Code", "Method", "Payout handle", "Gross profit", "Carry-forward", "Net", "Commission", "Rolled in", "Pay", "Status", "Paid at", "Payment ref"];
  const lines = rows.map((r) =>
    [
      r.affiliate.legalName,
      r.affiliate.referralCode ?? "",
      methodLabel(r.affiliate.payoutMethod),
      r.affiliate.payoutHandle ?? "",
      money(r.grossProfitCents),
      money(r.carryInCents),
      money(r.netCents),
      money(r.commissionCents),
      money(r.rolledInCents),
      money(r.payableCents),
      r.status,
      r.paidAt?.toISOString() ?? "",
      r.paymentRef ?? "",
    ]
      .map((v) => esc(String(v)))
      .join(","),
  );
  return [header.join(","), ...lines].join("\n") + "\n";
}

function stringify(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "bigint" ? String(v) : v]));
}
