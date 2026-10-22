// Development seed: mirrors the names and numbers in the mockups. Wipes the database first.
// Run with `npm run db:seed` (or automatically after `npx prisma migrate reset`).

import { PrismaClient, type PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { normalizeEmail, normalizeHandle, normalizePhone } from "../src/lib/contacts";
import { putBytes } from "../src/lib/storage";
import { closeWeek, markPaid } from "../src/lib/payouts";
import { closeDueRaceMonths } from "../src/lib/race";
import { weekFor, zonedLocalToDate } from "../src/lib/weeks";
import { deflateSync } from "node:zlib";

const db = new PrismaClient();

/** A 320×200 grey "receipt" placeholder PNG, so seeded entries have a screenshot to look at. */
function samplePng(): Uint8Array {
  const w = 320, h = 200;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const band = y < 40 ? 0x3c : (y >> 4) % 2 ? 0xe8 : 0xf4; // green header, striped body
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = y < 40 ? 0x3c : band;
      raw[o + 1] = y < 40 ? 0xc7 : band;
      raw[o + 2] = y < 40 ? 0x95 : band;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
const DEV_PASSWORD = "opengrowth";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database.");

  await db.$executeRawUnsafe(`
    TRUNCATE notifications, email_messages, verification_codes, rate_limits, audit_log, settings, flags, race_results, race_months, affiliate_weeks, transaction_edits,
      transactions, weeks, players, id_documents, staff, affiliates, contact_registry, sessions, users CASCADE`);

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const now = new Date();

  await db.setting.create({ data: { key: "business", value: DEFAULT_SETTINGS } });

  const staffUser = async (email: string, phone: string, role: "employee" | "ops" | "admin", name: string, code: string) =>
    db.user.create({
      data: {
        email,
        phone: normalizePhone(phone),
        passwordHash,
        role,
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
        staff: { create: { displayName: name, displayCode: code, team: role === "employee" ? "Team A" : "Management", shiftStart: "08:00", shiftEnd: "16:00" } },
      },
    });

  await staffUser("admin@opengrowth.local", "555-000-0001", "admin", "Owner", "AD");
  await staffUser("ops@opengrowth.local", "555-000-0002", "ops", "Ops Manager", "OP");
  await staffUser("a1@opengrowth.local", "555-000-0011", "employee", "Employee A1", "A1");
  await staffUser("a2@opengrowth.local", "555-000-0012", "employee", "Employee A2", "A2");
  await staffUser("a3@opengrowth.local", "555-000-0013", "employee", "Employee A3", "A3");

  const methods: PaymentMethod[] = ["cash_app", "crypto", "venmo", "apple_pay", "paypal", "chime"];
  const affiliates = [];
  for (let i = 1; i <= 6; i++) {
    const n = String(i).padStart(2, "0");
    const email = normalizeEmail(`affiliate${n}@opengrowth.local`);
    const phone = normalizePhone(`555-010-00${n}`);
    const payoutHandle = `affiliate${n}`;
    const user = await db.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: "affiliate",
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
        affiliate: {
          create: {
            legalName: `Affiliate ${n}`,
            referralCode: `OG-A${n}`,
            payoutMethod: methods[i - 1],
            payoutHandle,
            status: "active",
            idStatus: i === 2 ? "verified" : "none",
          },
        },
      },
      include: { affiliate: true },
    });
    const a = user.affiliate!;
    affiliates.push(a);
    await db.contactRegistry.createMany({
      data: [
        { kind: "email", valueNormalized: email, ownerType: "affiliate", ownerId: a.id },
        { kind: "phone", valueNormalized: phone, ownerType: "affiliate", ownerId: a.id },
        { kind: "payment_handle", valueNormalized: normalizeHandle(payoutHandle), ownerType: "affiliate", ownerId: a.id },
      ],
    });
  }

  // Players 01–21, spread across the affiliates; all links confirmed by A1.
  const a1 = await db.user.findUniqueOrThrow({ where: { email: "a1@opengrowth.local" } });
  for (let i = 1; i <= 21; i++) {
    const n = String(i).padStart(2, "0");
    const affiliate = affiliates[(i - 1) % affiliates.length];
    const email = normalizeEmail(`player${n}@example.com`);
    const phone = normalizePhone(`555-020-00${n}`);
    const player = await db.player.create({
      data: {
        handle: `player${n}`,
        email,
        phone,
        paymentHandle: `player${n}`,
        affiliateId: affiliate.id,
        linkSource: "code_at_desk",
        linkStatus: "confirmed",
        linkConfirmedBy: a1.id,
        linkConfirmedAt: now,
      },
    });
    await db.contactRegistry.createMany({
      data: [
        { kind: "email", valueNormalized: email, ownerType: "player", ownerId: player.id },
        { kind: "phone", valueNormalized: phone, ownerType: "player", ownerId: player.id },
        { kind: "payment_handle", valueNormalized: `player${n}`, ownerType: "player", ownerId: player.id },
      ],
    });
  }

  // The desk mockup's "New players" queue: Player 22 is clean; Player 23's phone is Affiliate 06's (likely self-referral).
  const p22 = await db.player.create({
    data: { handle: "player22", email: "player22@example.com", phone: normalizePhone("555-020-0022"), paymentHandle: "player22", affiliateId: affiliates[0].id, linkSource: "link", linkStatus: "pending" },
  });
  const p23 = await db.player.create({
    data: { handle: "player23", email: "player23@example.com", phone: normalizePhone("555-010-0006"), paymentHandle: "player23", affiliateId: affiliates[5].id, linkSource: "link", linkStatus: "pending" },
  });
  await db.contactRegistry.createMany({
    data: [
      { kind: "email", valueNormalized: "player22@example.com", ownerType: "player", ownerId: p22.id },
      { kind: "phone", valueNormalized: normalizePhone("555-020-0022"), ownerType: "player", ownerId: p22.id },
      { kind: "email", valueNormalized: "player23@example.com", ownerType: "player", ownerId: p23.id },
      // player23's phone is not registered: it belongs to Affiliate 06.
    ],
  });

  // One self-serve signup waiting for ops approval.
  const pendingUser = await db.user.create({
    data: {
      email: "newcomer@example.com",
      phone: normalizePhone("555-030-0001"),
      passwordHash,
      role: "affiliate",
      affiliate: { create: { legalName: "Jordan Newcomer", payoutMethod: "cash_app", payoutHandle: "$jordannew", status: "pending_approval" } },
    },
    include: { affiliate: true },
  });
  await db.contactRegistry.createMany({
    data: [
      { kind: "email", valueNormalized: "newcomer@example.com", ownerType: "affiliate", ownerId: pendingUser.affiliate!.id },
      { kind: "phone", valueNormalized: normalizePhone("555-030-0001"), ownerType: "affiliate", ownerId: pendingUser.affiliate!.id },
    ],
  });

  // ---------- Transactions for the current week (dashboard + desk mockups) ----------
  const staffId = async (code: string) => (await db.staff.findUniqueOrThrow({ where: { displayCode: code } })).userId;
  const [A1, A2, A3] = [await staffId("A1"), await staffId("A2"), await staffId("A3")];
  const bounds = weekFor(now);
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  const week = await db.week.create({ data: { startsOn: day(bounds.startsOn), endsOn: day(bounds.endsOn), payoutDate: day(bounds.payoutDate) } });
  const weekStart = zonedLocalToDate(`${bounds.startsOn}T00:00`).getTime();
  const at = (minutesAgo: number) => new Date(Math.max(weekStart + 60_000, now.getTime() - minutesAgo * 60_000));
  const sample = await putBytes("screenshots", samplePng(), "png");
  const player = async (h: string) => db.player.findUniqueOrThrow({ where: { handle: h } });

  let ref = 1000;
  const tx = async (
    handle: string,
    type: "deposit" | "cashout",
    dollars: number,
    method: PaymentMethod,
    enteredBy: string,
    status: "pending" | "verified" | "rejected",
    minutesAgo: number,
    extra: { verifiedBy?: string; rejectReason?: string } = {},
  ) => {
    const p = await player(handle);
    await db.transaction.create({
      data: {
        playerId: p.id,
        affiliateId: p.affiliateId,
        type,
        amountCents: BigInt(dollars * 100),
        method,
        externalRef: `SEED-${ref++}`,
        screenshotKey: sample,
        occurredAt: at(minutesAgo),
        createdAt: at(minutesAgo),
        enteredBy,
        status,
        ...(status === "verified" ? { verifiedBy: extra.verifiedBy, verifiedAt: at(minutesAgo - 1), weekId: week.id } : {}),
        ...(status === "rejected" ? { rejectReason: extra.rejectReason } : {}),
      },
    });
  };

  // Affiliate 01 (players 01, 07, 13, 19): $3,860 deposits − $2,440 cashouts = $1,420 → $71.00, as in the dashboard mockup.
  await tx("player01", "deposit", 1200, "cash_app", A1, "verified", 300, { verifiedBy: A2 });
  await tx("player01", "cashout", 400, "cash_app", A1, "verified", 290, { verifiedBy: A2 });
  await tx("player07", "deposit", 950, "chime", A1, "verified", 280, { verifiedBy: A2 });
  await tx("player07", "cashout", 700, "chime", A2, "verified", 270, { verifiedBy: A1 });
  await tx("player13", "deposit", 600, "venmo", A2, "verified", 260, { verifiedBy: A3 });
  await tx("player19", "deposit", 1110, "paypal", A3, "verified", 250, { verifiedBy: A1 });
  await tx("player19", "cashout", 1340, "paypal", A3, "verified", 240, { verifiedBy: A2 });
  // ---------- History: weeks 5→2 ago, closed and paid by the real engine ----------
  // Same numbers as the mockups where they agree: Affiliate 01's payout history (Sep 21 $94, Sep 28 carried −$320,
  // Oct 5 $107 after the carry), Affiliate 02 carrying −$260 into last week, and the October race standings.
  const weekRows = new Map<number, string>();
  const weekId = async (weeksAgo: number) => {
    if (!weekRows.has(weeksAgo)) {
      const b = weekFor(new Date(now.getTime() - weeksAgo * 7 * 864e5));
      const w = await db.week.create({ data: { startsOn: day(b.startsOn), endsOn: day(b.endsOn), payoutDate: day(b.payoutDate) } });
      weekRows.set(weeksAgo, w.id);
    }
    return weekRows.get(weeksAgo)!;
  };
  const old = async (weeksAgo: number, handle: string, type: "deposit" | "cashout", dollars: number, method: PaymentMethod, hoursIn = 0) => {
    const p = await player(handle);
    const b = weekFor(new Date(now.getTime() - weeksAgo * 7 * 864e5));
    const when = new Date(zonedLocalToDate(`${b.startsOn}T12:00`).getTime() + 2 * 864e5 + hoursIn * 3_600_000); // Wednesday noon
    await db.transaction.create({
      data: {
        playerId: p.id, affiliateId: p.affiliateId, type, amountCents: BigInt(Math.round(dollars * 100)), method,
        externalRef: `SEED-${ref++}`, screenshotKey: sample, occurredAt: when, createdAt: when,
        enteredBy: A1, verifiedBy: A2, verifiedAt: when, status: "verified", weekId: await weekId(weeksAgo),
      },
    });
  };
  const opsId = (await db.user.findUniqueOrThrow({ where: { email: "ops@opengrowth.local" } })).id;
  const closeAndPay = async (weeksAgo: number) => {
    const id = await weekId(weeksAgo);
    const w = await db.week.findUniqueOrThrow({ where: { id } });
    await closeWeek(id, null, new Date(w.payoutDate.getTime() + 16 * 3_600_000));
    for (const r of await db.affiliateWeek.findMany({ where: { weekId: id, status: "ready" } })) {
      await markPaid(r.id, opsId, "seed");
      await db.affiliateWeek.update({ where: { id: r.id }, data: { paidAt: new Date(w.payoutDate.getTime() + 16 * 3_600_000) } });
    }
  };

  await old(5, "player01", "deposit", 1880, "cash_app");
  await old(5, "player06", "deposit", 4200, "chime");
  await old(5, "player02", "deposit", 2500, "crypto");
  await closeAndPay(5);
  await old(4, "player07", "deposit", 500, "chime");
  await old(4, "player13", "cashout", 820, "venmo", 1);
  await closeAndPay(4);
  await old(3, "player01", "deposit", 2460, "cash_app");
  await closeAndPay(3);
  await old(2, "player19", "deposit", 760, "paypal");
  await old(2, "player02", "deposit", 1000, "crypto");
  await old(2, "player08", "cashout", 1260, "crypto", 1);
  await old(2, "player03", "deposit", 7000, "venmo");
  await old(2, "player05", "deposit", 4110, "paypal");
  await old(2, "player06", "deposit", 6900, "chime");
  await closeAndPay(2);

  // ---------- Last week (ops payout-run mockup): left OPEN so ops can run "Close week now" ----------
  // Gross: A01 $3,000 · A02 $1,840 (carrying −$260) · A03 −$410 · A04 $160 · A05 $2,200 (flagged) · A06 $2,960.
  await old(1, "player01", "deposit", 4000, "cash_app", 0);
  await old(1, "player07", "deposit", 3450, "chime", 1);
  await old(1, "player13", "cashout", 2450, "venmo", 2);
  await old(1, "player19", "cashout", 2000, "paypal", 3);
  await old(1, "player02", "deposit", 2500, "crypto", 4);
  await old(1, "player08", "cashout", 660, "crypto", 5);
  await old(1, "player03", "deposit", 590, "venmo", 6);
  await old(1, "player09", "cashout", 1000, "venmo", 7);
  await old(1, "player04", "deposit", 160, "apple_pay", 8);
  await old(1, "player05", "deposit", 2200, "paypal", 9);
  await old(1, "player06", "deposit", 3500, "chime", 10);
  await old(1, "player12", "cashout", 540, "chime", 11);

  // Affiliate 05: a referred player shares a payment handle with the affiliate → flagged.
  const p24 = await db.player.create({
    data: { handle: "player24", paymentHandle: "affiliate05", affiliateId: affiliates[4].id, linkSource: "code_at_desk", linkStatus: "sent_to_ops" },
  });
  await db.flag.create({ data: { affiliateId: affiliates[4].id, playerId: p24.id, reason: "payment_handle_match", detail: "Entered by staff" } });
  await db.affiliate.update({ where: { id: affiliates[4].id }, data: { status: "flagged" } });

  // The desk mockup's queue.
  await tx("player07", "deposit", 200, "cash_app", A1, "pending", 30);
  await tx("player12", "cashout", 450, "chime", A2, "pending", 40);
  await tx("player03", "deposit", 600, "crypto", A3, "pending", 50);
  await tx("player21", "deposit", 150, "venmo", A1, "verified", 60, { verifiedBy: A2 });
  await tx("player09", "cashout", 900, "paypal", A2, "rejected", 70, { rejectReason: "Ref not found in the app" });

  // September's race is settled (its prizes wait on ID checks); October stays live.
  await closeDueRaceMonths(now);
  // Affiliate 06 (1st place in the October race) has sent an ID for review.
  await db.idDocument.create({ data: { affiliateId: affiliates[5].id, frontKey: sample, selfieKey: sample, nameOnId: "Affiliate 06" } });
  await db.affiliate.update({ where: { id: affiliates[5].id }, data: { idStatus: "submitted" } });

  console.log(`Seeded 5 staff, ${affiliates.length + 1} affiliates (1 pending), 24 players (2 waiting, 1 flagged), history over 6 weeks. Password for every account: "${DEV_PASSWORD}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
