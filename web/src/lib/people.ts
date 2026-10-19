// Creating affiliates and players under the "one person, one account" rules.
//
// - Email and phone are unique across every affiliate and player (contact_registry + a partial unique index).
// - A player whose email, phone or payment handle matches THEIR OWN affiliate is a likely self-referral:
//   the player is still created, but the link cannot be confirmed until ops reviews it.

import { Prisma, type Affiliate, type FlagReason, type LinkSource, type PaymentMethod, type User } from "@prisma/client";
import { db } from "./db";
import { normalizeEmail, normalizeHandle, normalizePhone } from "./contacts";
import { RuleError } from "./errors";

type Tx = Prisma.TransactionClient;

export class PeopleError extends RuleError {}

export type AffiliateWithUser = Affiliate & { user: User };

// ---------- Matching ----------

export type ContactInput = { email?: string | null; phone?: string | null; paymentHandle?: string | null };

/** Which of the player's contact details match their affiliate's own. Empty = no self-referral signal. */
export function selfReferralReasons(player: ContactInput, affiliate: AffiliateWithUser): FlagReason[] {
  const reasons: FlagReason[] = [];
  if (player.email && normalizeEmail(player.email) === normalizeEmail(affiliate.user.email)) reasons.push("email_match");
  if (player.phone && normalizePhone(player.phone) === normalizePhone(affiliate.user.phone)) reasons.push("phone_match");
  if (
    player.paymentHandle &&
    affiliate.payoutHandle &&
    normalizeHandle(player.paymentHandle) === normalizeHandle(affiliate.payoutHandle)
  )
    reasons.push("payment_handle_match");
  return reasons;
}

/** Who already holds this email or phone, as words ops can act on ("Affiliate 03's account"). */
async function describeOwner(tx: Tx, ownerType: "affiliate" | "player", ownerId: string): Promise<string> {
  if (ownerType === "affiliate") {
    const a = await tx.affiliate.findUnique({ where: { id: ownerId } });
    return a ? `${a.legalName}'s account` : "another affiliate";
  }
  const p = await tx.player.findUnique({ where: { id: ownerId } });
  return p ? `player ${p.handle}` : "another player";
}

/** Throws if the email or phone is already used by any affiliate, player or staff login. */
async function assertContactsFree(tx: Tx, email: string, phone: string, opts: { revealOwner: boolean }) {
  for (const [kind, value] of [
    ["email", email],
    ["phone", phone],
  ] as const) {
    const taken = await tx.contactRegistry.findFirst({ where: { kind, valueNormalized: value } });
    const staffTaken = await tx.user.findFirst({ where: kind === "email" ? { email: value } : { phone: value } });
    if (taken || staffTaken) {
      const owner = taken && opts.revealOwner ? await describeOwner(tx, taken.ownerType, taken.ownerId) : null;
      throw new PeopleError(
        owner
          ? `This ${kind === "email" ? "email" : "phone number"} is already on ${owner}.`
          : `This ${kind === "email" ? "email" : "phone number"} is already registered. One person, one account.`,
      );
    }
  }
}

// ---------- Referral codes ----------

/** Next code in the OG-A01, OG-A02 … sequence. */
async function nextReferralCode(tx: Tx): Promise<string> {
  const rows = await tx.$queryRaw<{ n: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(referral_code FROM 5) AS INTEGER)) AS n
    FROM affiliates WHERE referral_code ~ '^OG-A[0-9]+$'`;
  const next = (rows[0]?.n ?? 0) + 1;
  return `OG-A${String(next).padStart(2, "0")}`;
}

// ---------- Affiliates ----------

export type NewAffiliate = {
  legalName: string;
  email: string;
  phone: string;
  passwordHash: string | null;
  payoutMethod?: PaymentMethod | null;
  payoutHandle?: string | null;
};

/**
 * Creates the login and the affiliate. `approve` = issue the OG code now (ops registration);
 * otherwise the affiliate waits in pending_approval (self-serve signup).
 */
export async function createAffiliate(
  input: NewAffiliate,
  opts: { approve: boolean; actorId: string | null; revealOwner: boolean },
) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const payoutHandle = input.payoutHandle?.trim() || null;

  return withUniqueRetry(() =>
    db.$transaction(async (tx) => {
      await assertContactsFree(tx, email, phone, { revealOwner: opts.revealOwner });
      const referralCode = opts.approve ? await nextReferralCode(tx) : null;
      const user = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash: input.passwordHash,
          role: "affiliate",
          affiliate: {
            create: {
              legalName: input.legalName.trim(),
              referralCode,
              payoutMethod: input.payoutMethod ?? null,
              payoutHandle,
              status: opts.approve ? "active" : "pending_approval",
            },
          },
        },
        include: { affiliate: true },
      });
      const a = user.affiliate!;
      await tx.contactRegistry.createMany({
        data: [
          { kind: "email", valueNormalized: email, ownerType: "affiliate", ownerId: a.id },
          { kind: "phone", valueNormalized: phone, ownerType: "affiliate", ownerId: a.id },
          ...(payoutHandle
            ? [{ kind: "payment_handle" as const, valueNormalized: normalizeHandle(payoutHandle), ownerType: "affiliate" as const, ownerId: a.id }]
            : []),
        ],
      });
      await tx.auditLog.create({
        data: {
          actorId: opts.actorId ?? user.id,
          action: opts.approve ? "affiliate.register" : "affiliate.signup",
          entity: "affiliate",
          entityId: a.id,
          after: { legalName: a.legalName, email, phone, referralCode },
        },
      });
      return { user, affiliate: a };
    }),
  );
}

export async function approveAffiliate(affiliateId: string, actorId: string) {
  return withUniqueRetry(() =>
    db.$transaction(async (tx) => {
      const a = await tx.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
      if (a.status !== "pending_approval") throw new PeopleError("This affiliate is not waiting for approval.");
      const referralCode = await nextReferralCode(tx);
      const updated = await tx.affiliate.update({ where: { id: a.id }, data: { status: "active", referralCode } });
      await tx.auditLog.create({
        data: { actorId, action: "affiliate.approve", entity: "affiliate", entityId: a.id, after: { referralCode } },
      });
      return updated;
    }),
  );
}

export async function declineAffiliate(affiliateId: string, actorId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const a = await tx.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
    if (a.status !== "pending_approval") throw new PeopleError("This affiliate is not waiting for approval.");
    await tx.affiliate.update({ where: { id: a.id }, data: { status: "inactive" } });
    await tx.user.update({ where: { id: a.userId }, data: { status: "inactive" } });
    // Free the email and phone so the person can be registered correctly later.
    await tx.contactRegistry.deleteMany({ where: { ownerType: "affiliate", ownerId: a.id } });
    await tx.auditLog.create({ data: { actorId, action: "affiliate.decline", entity: "affiliate", entityId: a.id, after: { reason } } });
  });
}

// ---------- Players ----------

export type NewPlayer = { handle: string; email?: string | null; phone?: string | null; paymentHandle?: string | null };

/**
 * Creates a player linked to the affiliate behind `referralCode`.
 *
 * - source "link": the player signed up through the affiliate's link → link is pending until the desk confirms.
 * - source "code_at_desk" / "ops_tag": staff entered it → confirmed at once, unless it matches the affiliate,
 *   in which case it goes straight to ops with a flag.
 */
export async function createLinkedPlayer(
  input: NewPlayer,
  referralCode: string,
  opts: { source: LinkSource; actorId: string | null },
) {
  const handle = normalizeHandle(input.handle);
  if (!/^[a-z0-9_.-]{3,32}$/.test(handle))
    throw new PeopleError("Player handle: 3–32 letters, numbers, dots, dashes or underscores.");
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  const paymentHandle = input.paymentHandle?.trim() ? input.paymentHandle.trim() : null;

  return withUniqueRetry(() =>
    db.$transaction(async (tx) => {
      const affiliate = await tx.affiliate.findUnique({
        where: { referralCode: referralCode.trim().toUpperCase() },
        include: { user: true },
      });
      if (!affiliate || affiliate.status === "inactive" || affiliate.status === "disqualified")
        throw new PeopleError("That referral code isn't active. Check the code with the affiliate.");

      if (await tx.player.findUnique({ where: { handle } })) throw new PeopleError(`Player handle "${handle}" is already registered.`);

      const reasons = selfReferralReasons({ email, phone, paymentHandle }, affiliate);

      // Email/phone must be new — except when they match this player's own affiliate (that's the flag case).
      for (const [kind, value, reason] of [
        ["email", email, "email_match"],
        ["phone", phone, "phone_match"],
      ] as const) {
        if (!value || reasons.includes(reason)) continue;
        const taken =
          (await tx.contactRegistry.findFirst({ where: { kind, valueNormalized: value } })) ??
          (await tx.user.findFirst({ where: kind === "email" ? { email: value } : { phone: value } }));
        if (taken) throw new PeopleError(`This ${kind === "email" ? "email" : "phone number"} is already registered.`);
      }

      const staffEntered = opts.source !== "link";
      const linkStatus = reasons.length ? (staffEntered ? "sent_to_ops" : "pending") : staffEntered ? "confirmed" : "pending";
      const now = new Date();

      const player = await tx.player.create({
        data: {
          handle,
          email,
          phone,
          paymentHandle,
          affiliateId: affiliate.id,
          linkSource: opts.source,
          linkStatus,
          linkConfirmedBy: linkStatus === "confirmed" ? opts.actorId : null,
          linkConfirmedAt: linkStatus === "confirmed" ? now : null,
        },
      });

      await tx.contactRegistry.createMany({
        data: [
          ...(email && !reasons.includes("email_match")
            ? [{ kind: "email" as const, valueNormalized: email, ownerType: "player" as const, ownerId: player.id }]
            : []),
          ...(phone && !reasons.includes("phone_match")
            ? [{ kind: "phone" as const, valueNormalized: phone, ownerType: "player" as const, ownerId: player.id }]
            : []),
          ...(paymentHandle
            ? [{ kind: "payment_handle" as const, valueNormalized: normalizeHandle(paymentHandle), ownerType: "player" as const, ownerId: player.id }]
            : []),
        ],
      });

      if (linkStatus === "sent_to_ops") await openFlags(tx, affiliate.id, player.id, reasons, "Entered by staff");

      await tx.auditLog.create({
        data: {
          actorId: opts.actorId,
          action: `player.create.${opts.source}`,
          entity: "player",
          entityId: player.id,
          after: { handle, affiliate: affiliate.referralCode, linkStatus, reasons },
        },
      });
      return { player, affiliate, reasons };
    }),
  );
}

async function openFlags(tx: Tx, affiliateId: string, playerId: string, reasons: FlagReason[], detail: string) {
  await tx.flag.createMany({ data: reasons.map((reason) => ({ affiliateId, playerId, reason, detail })) });
  await tx.affiliate.update({ where: { id: affiliateId }, data: { status: "flagged" } });
}

/** Desk: confirm a pending link. Refused when the player matches their affiliate. */
export async function confirmPlayerLink(playerId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const p = await tx.player.findUniqueOrThrow({ where: { id: playerId }, include: { affiliate: { include: { user: true } } } });
    if (p.linkStatus !== "pending") throw new PeopleError("This player is no longer waiting for confirmation.");
    if (p.affiliate && selfReferralReasons(p, p.affiliate).length)
      throw new PeopleError("This player matches their affiliate. Send it to ops instead.");
    await tx.player.update({
      where: { id: p.id },
      data: { linkStatus: "confirmed", linkConfirmedBy: actorId, linkConfirmedAt: new Date() },
    });
    await tx.auditLog.create({ data: { actorId, action: "player.link.confirm", entity: "player", entityId: p.id } });
  });
}

export async function rejectPlayerLink(playerId: string, actorId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const p = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    if (p.linkStatus !== "pending") throw new PeopleError("This player is no longer waiting for confirmation.");
    await tx.player.update({ where: { id: p.id }, data: { linkStatus: "rejected" } });
    await tx.auditLog.create({ data: { actorId, action: "player.link.reject", entity: "player", entityId: p.id, after: { reason } } });
  });
}

export async function sendPlayerToOps(playerId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const p = await tx.player.findUniqueOrThrow({ where: { id: playerId }, include: { affiliate: { include: { user: true } } } });
    if (p.linkStatus !== "pending" || !p.affiliate) throw new PeopleError("This player is no longer waiting for confirmation.");
    const reasons = selfReferralReasons(p, p.affiliate);
    await tx.player.update({ where: { id: p.id }, data: { linkStatus: "sent_to_ops" } });
    await openFlags(tx, p.affiliate.id, p.id, reasons.length ? reasons : ["other"], "Sent to ops from the desk");
    await tx.auditLog.create({ data: { actorId, action: "player.link.send_to_ops", entity: "player", entityId: p.id, after: { reasons } } });
  });
}

// ---------- Flags ----------

/**
 * Ops decision on a flag.
 * - clear: not a self-referral → the player's link is confirmed.
 * - disqualify: the player's link is rejected, so the affiliate never earns on them.
 * The affiliate goes back to active once none of their flags are open.
 */
export async function resolveFlag(flagId: string, decision: "clear" | "disqualify", actorId: string, note: string) {
  await db.$transaction(async (tx) => {
    const flag = await tx.flag.findUniqueOrThrow({ where: { id: flagId } });
    if (flag.status !== "open") throw new PeopleError("This flag is already resolved.");

    // One decision covers every open flag for the same player (email + phone match = one review).
    const siblings = await tx.flag.findMany({
      where: { status: "open", affiliateId: flag.affiliateId, playerId: flag.playerId ?? undefined },
    });
    const ids = flag.playerId ? siblings.map((f) => f.id) : [flag.id];
    await tx.flag.updateMany({
      where: { id: { in: ids } },
      data: { status: decision === "clear" ? "cleared" : "disqualified", resolvedBy: actorId, resolvedAt: new Date() },
    });

    if (flag.playerId) {
      await tx.player.update({
        where: { id: flag.playerId },
        data:
          decision === "clear"
            ? { linkStatus: "confirmed", linkConfirmedBy: actorId, linkConfirmedAt: new Date() }
            : { linkStatus: "rejected" },
      });
    }

    const stillOpen = await tx.flag.count({ where: { affiliateId: flag.affiliateId, status: "open" } });
    const affiliate = await tx.affiliate.findUniqueOrThrow({ where: { id: flag.affiliateId } });
    if (!stillOpen && affiliate.status === "flagged")
      await tx.affiliate.update({ where: { id: affiliate.id }, data: { status: "active" } });

    await tx.auditLog.create({
      data: { actorId, action: `flag.${decision}`, entity: "flag", entityId: flag.id, after: { note, flagIds: ids } },
    });
  });
}

// ---------- Helpers ----------

/** Two people racing for the same code/handle/email hit a unique index; retry once, then explain. */
async function withUniqueRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        if (attempt < 1) continue;
        throw new PeopleError("Someone just registered the same details. Check them and try again.");
      }
      throw e;
    }
  }
}
