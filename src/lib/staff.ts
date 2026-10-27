// Staff logins (desk employees, ops managers, admins), managed by the admin under Staff.

import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { hashPassword } from "./auth";
import { normalizeEmail, normalizePhone } from "./contacts";
import { RuleError } from "./errors";

export type StaffRole = Extract<Role, "employee" | "ops" | "admin">;
export const STAFF_ROLES: StaffRole[] = ["employee", "ops", "admin"];

/** The team shown on a staff member's profile and desk card follows from their role. */
export const teamFor = (role: StaffRole) => (role === "employee" ? "Desk" : "Management");

const tempPassword = () => randomBytes(6).toString("base64url");

export async function createStaff(
  input: { role: StaffRole; name: string; email: string; phone: string; code: string },
  actorId: string,
) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const code = input.code.toUpperCase();
  if (await db.user.findUnique({ where: { email } })) throw new RuleError("This email already has a login.");
  if (await db.user.findUnique({ where: { phone } })) throw new RuleError("This phone number already has a login.");
  if (await db.staff.findUnique({ where: { displayCode: code } })) throw new RuleError(`The code ${code} is taken. Pick another.`);

  const password = tempPassword();
  const user = await db.user.create({
    data: {
      email,
      phone,
      role: input.role,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      staff: { create: { displayName: input.name, displayCode: code, team: teamFor(input.role) } },
    },
  });
  await db.auditLog.create({ data: { actorId, action: "staff.create", entity: "user", entityId: user.id, after: { email, role: input.role, code } } });
  return { email, password };
}

/** A new one-time password. Their open sessions end, so the old password stops working everywhere. */
export async function resetStaffPassword(userId: string, actorId: string) {
  const user = await staffUser(userId);
  const password = tempPassword();
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.auditLog.create({ data: { actorId, action: "staff.reset_password", entity: "user", entityId: user.id } });
  return { email: user.email, password };
}

/** Turning someone off logs them out at once. The admin can't turn off their own login or the last admin. */
export async function setStaffActive(userId: string, active: boolean, actorId: string) {
  const user = await staffUser(userId);
  if (!active) {
    if (user.id === actorId) throw new RuleError("You can't turn off your own login.");
    if (user.role === "admin" && (await db.user.count({ where: { role: "admin", status: "active" } })) <= 1)
      throw new RuleError("This is the only admin. Add another admin first.");
  }
  await db.user.update({ where: { id: user.id }, data: { status: active ? "active" : "suspended" } });
  if (!active) await db.session.deleteMany({ where: { userId: user.id } });
  await db.auditLog.create({ data: { actorId, action: active ? "staff.enable" : "staff.disable", entity: "user", entityId: user.id } });
  return user;
}

async function staffUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { staff: true } });
  if (!user?.staff || !STAFF_ROLES.includes(user.role as StaffRole)) throw new RuleError("That staff login doesn't exist.");
  return user;
}
