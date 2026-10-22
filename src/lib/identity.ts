// ID checks: required before any payout over the threshold and before releasing any Top 3 prize.
// The name on the ID must match the account's legal name; ops compares them side by side.

import { db } from "./db";
import { RuleError } from "./errors";
import { refreshAllHeldRows } from "./payouts";

export async function submitId(affiliateId: string, input: { frontKey: string; selfieKey: string; nameOnId: string }) {
  const nameOnId = input.nameOnId.trim();
  if (nameOnId.length < 3) throw new RuleError("Type your name exactly as it appears on the ID.");
  await db.$transaction(async (tx) => {
    const a = await tx.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
    if (a.idStatus === "verified") throw new RuleError("Your ID is already verified.");
    if (a.idStatus === "submitted") throw new RuleError("Your ID is already waiting for review.");
    const doc = await tx.idDocument.create({ data: { affiliateId, frontKey: input.frontKey, selfieKey: input.selfieKey, nameOnId } });
    await tx.affiliate.update({ where: { id: affiliateId }, data: { idStatus: "submitted" } });
    await tx.auditLog.create({ data: { actorId: a.userId, action: "id.submit", entity: "id_document", entityId: doc.id } });
  });
}

export async function approveId(docId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const doc = await tx.idDocument.findUniqueOrThrow({ where: { id: docId } });
    if (doc.status !== "submitted") throw new RuleError("This ID was already reviewed.");
    await tx.idDocument.update({ where: { id: doc.id }, data: { status: "approved", reviewedBy: actorId } });
    await tx.affiliate.update({ where: { id: doc.affiliateId }, data: { idStatus: "verified" } });
    await tx.auditLog.create({ data: { actorId, action: "id.approve", entity: "id_document", entityId: doc.id } });
  });
  // Payouts held for "needs ID" can now be paid.
  await refreshAllHeldRows();
}

export async function rejectId(docId: string, actorId: string, reason: string) {
  if (!reason.trim()) throw new RuleError("Say why the ID was rejected, so the affiliate can fix it.");
  await db.$transaction(async (tx) => {
    const doc = await tx.idDocument.findUniqueOrThrow({ where: { id: docId } });
    if (doc.status !== "submitted") throw new RuleError("This ID was already reviewed.");
    await tx.idDocument.update({ where: { id: doc.id }, data: { status: "rejected", reviewedBy: actorId, rejectReason: reason.trim() } });
    await tx.affiliate.update({ where: { id: doc.affiliateId }, data: { idStatus: "rejected" } });
    await tx.auditLog.create({ data: { actorId, action: "id.reject", entity: "id_document", entityId: doc.id, after: { reason } } });
  });
}
