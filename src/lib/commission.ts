// The weekly commission rules, as pure functions. Every payout number in the app comes from here.
//
//   net        = gross profit + carry-in            (carry-in is 0 or negative)
//   commission = max(0, floor(net × rate))
//   carry-out  = min(0, net)                        (a loss carries forward until covered; never resets)
//   payable    = commission + rolled-in             (rolled-in = earlier amounts that were under the minimum)

import type { AffiliateWeekStatus } from "@prisma/client";

export type WeekInput = {
  depositsCents: bigint; // verified only
  cashoutsCents: bigint; // verified only
  carryInCents: bigint; // <= 0
  rolledInCents: bigint; // >= 0
  rateBp: number; // 500 = 5%
  minPayoutCents: bigint;
  idThresholdCents: bigint;
  idVerified: boolean;
  flagged: boolean;
};

export type WeekResult = {
  grossProfitCents: bigint;
  netCents: bigint;
  commissionCents: bigint;
  payableCents: bigint;
  carryOutCents: bigint;
  /** Amount that rolls into next week's payable because it is under the minimum (0 otherwise). */
  rollOutCents: bigint;
  status: AffiliateWeekStatus;
};

export function computeWeek(i: WeekInput): WeekResult {
  if (i.carryInCents > 0n) throw new Error("carry-in must be zero or negative");
  if (i.rolledInCents < 0n) throw new Error("rolled-in must be zero or positive");

  const grossProfitCents = i.depositsCents - i.cashoutsCents;
  const netCents = grossProfitCents + i.carryInCents;
  // bigint division truncates toward zero; net is positive here, so this is floor.
  const commissionCents = netCents > 0n ? (netCents * BigInt(i.rateBp)) / 10_000n : 0n;
  const carryOutCents = netCents < 0n ? netCents : 0n;
  const payableCents = commissionCents + i.rolledInCents;

  let status: AffiliateWeekStatus;
  let rollOutCents = 0n;
  if (i.flagged) {
    status = "flagged";
  } else if (payableCents === 0n && netCents < 0n) {
    status = "carried";
  } else if (payableCents < i.minPayoutCents) {
    status = "under_minimum";
    rollOutCents = payableCents;
  } else if (payableCents > i.idThresholdCents && !i.idVerified) {
    status = "needs_id";
  } else {
    status = "ready";
  }

  return { grossProfitCents, netCents, commissionCents, payableCents, carryOutCents, rollOutCents, status };
}

export type Badge = { name: string; minCents: number };

/** Highest badge whose threshold last month's earnings reach. */
export function badgeFor(lastMonthCents: bigint, thresholds: Badge[]): string {
  const sorted = [...thresholds].sort((a, b) => a.minCents - b.minCents);
  let name = sorted[0]?.name ?? "Builder";
  for (const t of sorted) if (lastMonthCents >= BigInt(t.minCents)) name = t.name;
  return name;
}
