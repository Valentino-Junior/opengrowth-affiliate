"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, homeFor, verifyPassword } from "@/lib/auth";
import { normalizeEmail } from "@/lib/contacts";
import { LIMITS, allow, clear, clientIp, hitsFor } from "@/lib/rate-limit";
import { RuleError } from "@/lib/errors";
import { resetPasswordWithCode, sendPasswordCode } from "@/lib/verification";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const TOO_MANY = "Too many attempts. Wait 15 minutes and try again.";

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = normalizeEmail(parsed.data.email);
  const failKey = `login-fail:${email}`;

  if (!(await allow(`login-ip:${await clientIp()}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.window))) return { error: TOO_MANY };
  // Lock the email after repeated wrong passwords, whichever IP they come from.
  if ((await hitsFor(failKey, LIMITS.failedLoginsPerEmail.window)) >= LIMITS.failedLoginsPerEmail.limit) return { error: TOO_MANY };

  const user = await db.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password, so the form can't be used to find accounts.
  const ok = user?.passwordHash && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !ok) {
    await allow(failKey, LIMITS.failedLoginsPerEmail.limit, LIMITS.failedLoginsPerEmail.window);
    return { error: "Email or password is wrong" };
  }
  if (user.status !== "active") return { error: "This account is not active. Message the team." };

  await clear(failKey);
  await createSession(user.id);
  await db.auditLog.create({ data: { actorId: user.id, action: "auth.login", entity: "user", entityId: user.id } });
  redirect(homeFor(user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------- Forgot password ----------

export type ForgotState = { error?: string; sentTo?: string };

const resetAllowed = async () => allow(`pw-reset-ip:${await clientIp()}`, LIMITS.passwordResetPerIp.limit, LIMITS.passwordResetPerIp.window);

/** Step 1: email a code. The answer is the same whether or not the email has an account. */
export async function requestPasswordCodeAction(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const parsed = z.string().email("Enter a valid email").safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await resetAllowed())) return { error: "Too many attempts. Try again in an hour." };
  const email = normalizeEmail(parsed.data);
  await sendPasswordCode(email);
  return { sentTo: email };
}

/** Step 2: the code and a new password. Success logs the account out everywhere and goes to Log in. */
export async function resetPasswordAction(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const next = String(form.get("newPassword") ?? "");
  const keep = { sentTo: email };
  if (next.length < 8) return { ...keep, error: "New password: at least 8 characters." };
  if (next !== String(form.get("confirmPassword") ?? "")) return { ...keep, error: "The two passwords don't match." };
  if (!(await resetAllowed())) return { ...keep, error: "Too many attempts. Try again in an hour." };
  try {
    await resetPasswordWithCode(email, String(form.get("code") ?? ""), await hashPassword(next));
  } catch (e) {
    if (e instanceof RuleError) return { ...keep, error: e.message };
    throw e;
  }
  await clear(`login-fail:${email}`); // a fresh password lifts the wrong-password lock
  redirect("/login?password=reset");
}
