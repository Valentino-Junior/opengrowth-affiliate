// Creates a staff login on a fresh (production) database, where the dev seed is not allowed.
//
//   npm run create-staff -- --role admin --email owner@example.com --phone "555-123-4567" --name "Owner" --code AD
//   npm run create-staff -- --role employee --email a1@example.com --phone "555-123-0001" --name "Jordan" --code A1 --team "Team A"
//
// Prints a one-time password unless STAFF_PASSWORD is set. Only the first admin needs this; the admin adds everyone else under Staff.

import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { normalizeEmail, normalizePhone } from "../src/lib/contacts";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const { values } = parseArgs({
  options: {
    role: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    name: { type: "string" },
    code: { type: "string" },
    team: { type: "string", default: "Management" },
  },
});

async function main() {
  const { role, email, phone, name, code, team } = values;
  if (!role || !["admin", "ops", "employee"].includes(role) || !email || !phone || !name || !code) {
    console.error('Usage: npm run create-staff -- --role admin|ops|employee --email X --phone X --name "X" --code XX [--team "Team A"]');
    process.exit(1);
  }
  const db = new PrismaClient();
  const password = process.env.STAFF_PASSWORD || randomBytes(9).toString("base64url");
  const user = await db.user.create({
    data: {
      email: normalizeEmail(email),
      phone: normalizePhone(phone),
      passwordHash: await bcrypt.hash(password, 12),
      role: role as "admin" | "ops" | "employee",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      staff: { create: { displayName: name, displayCode: code.toUpperCase(), team: team! } },
    },
  });
  // First run: store the default business settings so they show in /admin/settings.
  await db.setting.upsert({ where: { key: "business" }, create: { key: "business", value: DEFAULT_SETTINGS }, update: {} });
  await db.auditLog.create({ data: { action: "staff.create", entity: "user", entityId: user.id, after: { email: user.email, role } } });
  console.log(`Created ${role} ${user.email}.`);
  if (!process.env.STAFF_PASSWORD) console.log(`One-time password: ${password}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
