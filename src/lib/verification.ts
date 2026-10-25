// Emailed 6-digit codes, to confirm an email address or to reset a forgotten password.
// 15 minutes, 5 tries, one new code per minute. Only a hash is stored.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { emailCodeMessage, passwordCodeMessage } from "./email";
import { RuleError } from "./errors";
import { allow } from "./rate-limit";

const VALID_MINUTES = 15;
const MAX_TRIES = 5;

const hash = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

type Purpose = "email" | "password";

/** Sends a fresh code to the user's email. Older unused codes for the same purpose stop working. */
async function issueCode(user: { id: string; email: string }, purpose: Purpose) {
  const last = await db.verificationCode.findFirst({ where: { userId: user.id, purpose }, orderBy: { createdAt: "desc" } });
  if (last && last.createdAt.getTime() > Date.now() - 60_000) throw new RuleError("A code was just sent. Wait a minute before asking for another.");
  if (!(await allow(`${purpose}-code:${user.id}`, 6, 60 * 60))) throw new RuleError("Too many codes sent. Try again in an hour.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction([
    db.verificationCode.deleteMany({ where: { userId: user.id, purpose, consumedAt: null } }),
    db.verificationCode.create({
      data: { userId: user.id, purpose, codeHash: hash(user.id, code), expiresAt: new Date(Date.now() + VALID_MINUTES * 60_000) },
    }),
  ]);
  await (purpose === "email" ? emailCodeMessage : passwordCodeMessage)(user.email, code);
}

/** Checks the latest code and returns it (not yet used up). Wrong codes count toward the 5 tries. */
async function checkCode(userId: string, purpose: Purpose, input: string) {
  const code = input.replace(/\D/g, "");
  if (code.length !== 6) throw new RuleError("Enter the 6-digit code from the email.");

  const row = await db.verificationCode.findFirst({ where: { userId, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date()) throw new RuleError("That code has expired. Ask for a new one.");
  if (row.attempts >= MAX_TRIES) throw new RuleError("Too many wrong tries. Ask for a new code.");

  const ok = timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hash(userId, code), "hex"));
  if (!ok) {
    await db.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_TRIES - row.attempts - 1;
    throw new RuleError(left > 0 ? `That code is wrong. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code.");
  }
  return row;
}

export const sendEmailCode = (user: { id: string; email: string }) => issueCode(user, "email");

/** Checks a code; on success the email is marked verified. */
export async function confirmEmailCode(userId: string, input: string) {
  const row = await checkCode(userId, "email", input);
  const now = new Date();
  await db.$transaction([
    db.verificationCode.update({ where: { id: row.id }, data: { consumedAt: now } }),
    db.user.update({ where: { id: userId }, data: { emailVerifiedAt: now } }),
    db.auditLog.create({ data: { actorId: userId, action: "account.email_verified", entity: "user", entityId: userId } }),
  ]);
}

/**
 * Forgot password, step 1. Says nothing about whether the email has an account: unknown emails,
 * turned-off accounts and "wait a minute" all look the same to the person asking.
 */
export async function sendPasswordCode(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") return;
  try {
    await issueCode(user, "password");
  } catch (e) {
    if (!(e instanceof RuleError)) throw e;
  }
}

/** Forgot password, step 2. The code proves they own the email, so it also counts as confirmed. Everyone is logged out. */
export async function resetPasswordWithCode(email: string, input: string, passwordHash: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") throw new RuleError("That code is wrong or has expired. Ask for a new one.");
  const row = await checkCode(user.id, "password", input);
  const now = new Date();
  await db.$transaction([
    db.verificationCode.update({ where: { id: row.id }, data: { consumedAt: now } }),
    db.user.update({ where: { id: user.id }, data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? now } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.auditLog.create({ data: { actorId: user.id, action: "account.password_reset", entity: "user", entityId: user.id } }),
  ]);
}
