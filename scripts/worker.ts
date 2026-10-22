// Background worker: closes each week after Sunday 23:59 and settles each month's Top 3 race, New York time.
// Runs next to the web app (on the VPS: its own container / systemd service). Safe to run more than one:
// closing a week is guarded in the database, so a second worker's attempt is simply refused.
//
//   npm run worker

import { closeDueWeeks } from "../src/lib/payouts";
import { closeDueRaceMonths } from "../src/lib/race";
import { db } from "../src/lib/db";

const EVERY_MS = 60_000;

async function tick() {
  try {
    const closed = await closeDueWeeks();
    for (const c of closed) console.log(`[worker] closed week starting ${c.week.startsOn.toISOString().slice(0, 10)}: ${c.rows} payout rows`);
    const races = await closeDueRaceMonths();
    for (const r of races) console.log(`[worker] settled race month ${r.month.toISOString().slice(0, 7)}`);
    // Housekeeping: expired sessions and stale rate-limit windows.
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 3_600_000) } } });
    await db.notification.deleteMany({ where: { readAt: { lt: new Date(Date.now() - 30 * 864e5) } } });
  } catch (e) {
    console.error("[worker] close failed:", e);
  }
}

console.log("[worker] started; checking for weeks to close every minute");
void tick();
setInterval(tick, EVERY_MS);
