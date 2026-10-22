import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";

// Database-backed sessions: the cookie holds a random token, the database holds only its SHA-256 hash.

const COOKIE = "og_session";
const SESSION_DAYS = 14;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}

/** Signs the user out on every device, this browser included (after a password change). */
export async function endAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { affiliate: true, staff: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "active") return null;
  return session.user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Who may enter each area. Ops and admin can do everything employees can. */
export const AREA_ROLES = {
  affiliate: ["affiliate"],
  desk: ["employee", "ops", "admin"],
  ops: ["ops", "admin"],
  admin: ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export async function requireRole(roles: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "affiliate":
      return "/dashboard";
    case "employee":
      return "/desk";
    case "ops":
      return "/ops";
    case "admin":
      return "/admin/settings";
  }
}
