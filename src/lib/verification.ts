// Email confirmation codes: 6 digits, 15 minutes, 5 tries, one new code per minute. Only a hash is stored.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { emailCodeMessage } from "./email";
import { RuleError } from "./errors";
import { allow } from "./rate-limit";

const VALID_MINUTES = 15;
const MAX_TRIES = 5;

const hash = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

/** Sends a fresh code to the user's email. Older unused codes stop working. */
export async function sendEmailCode(user: { id: string; email: string }) {
  const last = await db.verificationCode.findFirst({ where: { userId: user.id, purpose: "email" }, orderBy: { createdAt: "desc" } });
  if (last && last.createdAt.getTime() > Date.now() - 60_000) throw new RuleError("A code was just sent. Wait a minute before asking for another.");
  if (!(await allow(`email-code:${user.id}`, 6, 60 * 60))) throw new RuleError("Too many codes sent. Try again in an hour.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction([
    db.verificationCode.deleteMany({ where: { userId: user.id, purpose: "email", consumedAt: null } }),
    db.verificationCode.create({
      data: { userId: user.id, purpose: "email", codeHash: hash(user.id, code), expiresAt: new Date(Date.now() + VALID_MINUTES * 60_000) },
    }),
  ]);
  await emailCodeMessage(user.email, code);
}

/** Checks a code; on success the email is marked verified. */
export async function confirmEmailCode(userId: string, input: string) {
  const code = input.replace(/\D/g, "");
  if (code.length !== 6) throw new RuleError("Enter the 6-digit code from the email.");

  const row = await db.verificationCode.findFirst({ where: { userId, purpose: "email", consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date()) throw new RuleError("That code has expired. Ask for a new one.");
  if (row.attempts >= MAX_TRIES) throw new RuleError("Too many wrong tries. Ask for a new code.");

  const ok = timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hash(userId, code), "hex"));
  if (!ok) {
    await db.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_TRIES - row.attempts - 1;
    throw new RuleError(left > 0 ? `That code is wrong. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code.");
  }

  const now = new Date();
  await db.$transaction([
    db.verificationCode.update({ where: { id: row.id }, data: { consumedAt: now } }),
    db.user.update({ where: { id: userId }, data: { emailVerifiedAt: now } }),
    db.auditLog.create({ data: { actorId: userId, action: "account.email_verified", entity: "user", entityId: userId } }),
  ]);
}
