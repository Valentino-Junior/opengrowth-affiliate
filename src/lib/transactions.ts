// Deposits and cashouts: log → second-person verify → counts in the affiliate's week.
//
// - Only VERIFIED entries count toward gross profit.
// - Nobody verifies their own entry (also a DB check constraint).
// - A rejection needs a reason and goes back to whoever logged it.
// - Only ops edits an entry after it is verified, and every edit keeps a before/after copy.

import { Prisma, type PaymentMethod, type Role, type TxType } from "@prisma/client";
import { db } from "./db";
import { RuleError } from "./errors";
import { normalizeHandle } from "./contacts";
import { weekFor, type WeekBounds } from "./weeks";

type Tx = Prisma.TransactionClient;

export const MAX_AMOUNT_CENTS = 10_000_000n; // $100,000 per entry: anything bigger is a typo

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** The week row for these bounds, created on first use. */
export async function getOrCreateWeek(tx: Tx, w: WeekBounds) {
  return tx.week.upsert({
    where: { startsOn: asDate(w.startsOn) },
    create: { startsOn: asDate(w.startsOn), endsOn: asDate(w.endsOn), payoutDate: asDate(w.payoutDate) },
    update: {},
  });
}

/**
 * The week a verified entry counts in: the week it happened, unless that week is already closed —
 * then it lands in the current week, so closed weeks stay frozen.
 */
async function weekToCount(tx: Tx, occurredAt: Date) {
  const own = await getOrCreateWeek(tx, weekFor(occurredAt));
  if (own.status === "open") return own;
  return getOrCreateWeek(tx, weekFor(new Date()));
}

export type NewEntry = {
  type: TxType;
  playerHandle: string;
  amountCents: bigint;
  method: PaymentMethod;
  externalRef: string;
  screenshotKey: string;
  occurredAt: Date;
};

export async function logTransaction(input: NewEntry, enteredBy: string) {
  if (input.amountCents <= 0n) throw new RuleError("Amount must be more than $0.");
  if (input.amountCents > MAX_AMOUNT_CENTS) throw new RuleError("Amount is over $100,000. Check it, or split it as it shows in the app.");
  if (input.occurredAt.getTime() > Date.now() + 5 * 60_000) throw new RuleError("The time can't be in the future.");
  const externalRef = input.externalRef.trim();
  if (externalRef.length < 3) throw new RuleError("Enter the transaction ID / reference from the payment app.");

  try {
    return await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({
        where: { handle: normalizeHandle(input.playerHandle) },
        include: { affiliate: true },
      });
      if (!player) throw new RuleError(`No player "${normalizeHandle(input.playerHandle)}". Add them under New players first.`);
      if (player.linkStatus === "pending" || player.linkStatus === "sent_to_ops")
        throw new RuleError(`${player.handle}'s affiliate link isn't confirmed yet. Confirm it before logging money.`);

      // A rejected link means the player has no affiliate: the entry is still logged, it just earns nobody commission.
      const affiliateId = player.linkStatus === "confirmed" ? player.affiliateId : null;
      const entry = await tx.transaction.create({
        data: {
          playerId: player.id,
          affiliateId,
          type: input.type,
          amountCents: input.amountCents,
          method: input.method,
          externalRef,
          screenshotKey: input.screenshotKey,
          occurredAt: input.occurredAt,
          enteredBy,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: enteredBy,
          action: "transaction.log",
          entity: "transaction",
          entityId: entry.id,
          after: { type: entry.type, amountCents: String(entry.amountCents), method: entry.method, externalRef, player: player.handle },
        },
      });
      return { entry, player };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new RuleError("This transaction ID is already logged for that payment method. Check the verify queue.");
    throw e;
  }
}

export async function verifyTransaction(id: string, verifierId: string) {
  await db.$transaction(async (tx) => {
    const entry = await tx.transaction.findUniqueOrThrow({ where: { id } });
    if (entry.enteredBy === verifierId) throw new RuleError("You can't verify your own entry. Another teammate has to check it.");
    if (entry.status !== "pending") throw new RuleError("This entry was already handled by someone else.");
    const week = await weekToCount(tx, entry.occurredAt);
    // Only flips a still-pending row, so two people clicking Verify at once can't both succeed.
    const { count } = await tx.transaction.updateMany({
      where: { id, status: "pending" },
      data: { status: "verified", verifiedBy: verifierId, verifiedAt: new Date(), weekId: week.id },
    });
    if (count === 0) throw new RuleError("This entry was already handled by someone else.");
    await tx.auditLog.create({ data: { actorId: verifierId, action: "transaction.verify", entity: "transaction", entityId: id } });
  });
}

export async function rejectTransaction(id: string, reviewerId: string, reason: string) {
  if (!reason.trim()) throw new RuleError("A rejection needs a reason.");
  await db.$transaction(async (tx) => {
    const entry = await tx.transaction.findUniqueOrThrow({ where: { id } });
    if (entry.enteredBy === reviewerId) throw new RuleError("You can't review your own entry.");
    const { count } = await tx.transaction.updateMany({
      where: { id, status: "pending" },
      data: { status: "rejected", rejectReason: reason.trim(), verifiedBy: null },
    });
    if (count === 0) throw new RuleError("This entry was already handled by someone else.");
    await tx.auditLog.create({
      data: { actorId: reviewerId, action: "transaction.reject", entity: "transaction", entityId: id, after: { reason } },
    });
  });
}

export type EntryEdit = { type: TxType; amountCents: bigint; method: PaymentMethod; externalRef: string };

/** Ops-only correction of a verified entry. Refused once its week is closed (log a correcting entry instead). */
export async function editVerifiedTransaction(id: string, edit: EntryEdit, editor: { id: string; role: Role }, reason: string) {
  if (editor.role !== "ops" && editor.role !== "admin") throw new RuleError("Only an ops manager can edit a verified entry.");
  if (!reason.trim()) throw new RuleError("Say why the entry is being changed.");
  if (edit.amountCents <= 0n || edit.amountCents > MAX_AMOUNT_CENTS) throw new RuleError("Amount must be between $0.01 and $100,000.");

  try {
    await db.$transaction(async (tx) => {
      const entry = await tx.transaction.findUniqueOrThrow({ where: { id }, include: { week: true } });
      if (entry.status !== "verified") throw new RuleError("Only verified entries are edited here. Pending ones are rejected and logged again.");
      if (entry.week && entry.week.status !== "open")
        throw new RuleError("That week is closed and paid from. Log a correcting entry in the current week instead.");

      const pick = (t: Pick<typeof entry, "type" | "amountCents" | "method" | "externalRef">) => ({
        type: t.type,
        amountCents: String(t.amountCents),
        method: t.method,
        externalRef: t.externalRef,
      });
      const updated = await tx.transaction.update({
        where: { id },
        data: { type: edit.type, amountCents: edit.amountCents, method: edit.method, externalRef: edit.externalRef.trim() },
      });
      await tx.transactionEdit.create({
        data: { transactionId: id, editedBy: editor.id, before: pick(entry), after: pick(updated), reason: reason.trim() },
      });
      await tx.auditLog.create({
        data: { actorId: editor.id, action: "transaction.edit", entity: "transaction", entityId: id, before: pick(entry), after: pick(updated) },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new RuleError("Another entry already uses that transaction ID for this payment method.");
    throw e;
  }
}

/**
 * The entries that count toward an affiliate's week: verified, in that week, from players still
 * confirmed as theirs (a player disqualified as a self-referral stops counting).
 */
export function countableFor(affiliateId: string, weekId: string): Prisma.TransactionWhereInput {
  return { affiliateId, weekId, status: "verified", player: { linkStatus: "confirmed", affiliateId } };
}

/** Verified deposits and cashouts for an affiliate in the current (open) week. */
export async function liveWeekTotals(affiliateId: string, at = new Date()) {
  const bounds = weekFor(at);
  const week = await db.week.findUnique({ where: { startsOn: asDate(bounds.startsOn) } });
  if (!week) return { bounds, depositsCents: 0n, cashoutsCents: 0n };
  const sums = await db.transaction.groupBy({
    by: ["type"],
    where: countableFor(affiliateId, week.id),
    _sum: { amountCents: true },
  });
  const sum = (t: TxType) => sums.find((s) => s.type === t)?._sum.amountCents ?? 0n;
  return { bounds, depositsCents: sum("deposit"), cashoutsCents: sum("cashout") };
}
