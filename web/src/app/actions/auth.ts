"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, homeFor, verifyPassword } from "@/lib/auth";
import { normalizeEmail } from "@/lib/contacts";
import { LIMITS, allow, clear, clientIp, hitsFor } from "@/lib/rate-limit";

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
    return { error: "Email or password is wrong." };
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
