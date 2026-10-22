import { headers } from "next/headers";
import { db } from "./db";

// Fixed-window counters in Postgres. One atomic upsert per check, so concurrent requests can't slip past.

/** Counts one hit for `key`; returns true while the key is within `limit` hits per `windowSeconds`. */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ hits: number }[]>`
    INSERT INTO rate_limits (key, window_start, hits) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limits.hits + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limits.window_start END
    RETURNING hits`;
  return (rows[0]?.hits ?? 0) <= limit;
}

/** Current hits for a key without counting a new one (used to lock out an email after failed logins). */
export async function hitsFor(key: string, windowSeconds: number): Promise<number> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowStart.getTime() < Date.now() - windowSeconds * 1000) return 0;
  return row.hits;
}

export async function clear(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** The visitor's IP. Behind Caddy the real address arrives in X-Forwarded-For. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export const LIMITS = {
  loginPerIp: { limit: 100, window: 15 * 60 },
  failedLoginsPerEmail: { limit: 10, window: 15 * 60 },
  affiliateSignupPerIp: { limit: 5, window: 60 * 60 },
  playerSignupPerIp: { limit: 10, window: 60 * 60 },
} as const;
