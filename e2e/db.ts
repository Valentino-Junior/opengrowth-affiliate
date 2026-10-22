import { PrismaClient } from "@prisma/client";

// Direct database access for tests that need to "read the inbox" (emails are kept in email_messages while
// no email service is connected) or clean up after themselves.
export const db = new PrismaClient();

export async function latestEmail(to: string) {
  return db.emailMessage.findFirst({ where: { to }, orderBy: { createdAt: "desc" } });
}

export async function latestCode(to: string): Promise<string> {
  const mail = await latestEmail(to);
  const code = mail?.body?.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error(`No code emailed to ${to}`);
  return code;
}

/** Removes an affiliate created by a test, with everything attached to it. */
export async function deleteAffiliateByEmail(email: string) {
  const user = await db.user.findUnique({ where: { email }, include: { affiliate: true } });
  if (!user) return;
  if (user.affiliate) {
    await db.contactRegistry.deleteMany({ where: { ownerType: "affiliate", ownerId: user.affiliate.id } });
    await db.affiliate.delete({ where: { id: user.affiliate.id } });
  }
  await db.rateLimit.deleteMany({ where: { key: { contains: user.id } } });
  await db.user.delete({ where: { id: user.id } });
  await db.emailMessage.deleteMany({ where: { to: email } });
}
