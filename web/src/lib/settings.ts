import { z } from "zod";
import { db } from "./db";

// Business settings live in the `settings` table so ops can change them without a deploy.
// Each closed week copies the values it used (see weeks.rate_bp etc.).

export const settingsSchema = z.object({
  commissionRateBp: z.number().int().min(0).max(10_000),
  minPayoutCents: z.number().int().min(0),
  idThresholdCents: z.number().int().min(0),
  badgeThresholds: z.array(z.object({ name: z.string().min(1), minCents: z.number().int().min(0) })).min(1),
  prizes: z.object({ first: z.string(), second: z.string(), third: z.string() }),
  groupChatUrl: z.string(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  commissionRateBp: 500,
  minPayoutCents: 1_000,
  idThresholdCents: 50_000,
  badgeThresholds: [
    { name: "Builder", minCents: 0 },
    { name: "Hustler", minCents: 5_000 },
    { name: "Playmaker", minCents: 15_000 },
    { name: "Contender", minCents: 30_000 },
    { name: "Heavy Hitter", minCents: 60_000 },
    { name: "Kingpin", minCents: 100_000 },
    { name: "OG Status", minCents: 200_000 },
  ],
  prizes: { first: "A car", second: "A dirt bike", third: "An iPhone" },
  groupChatUrl: "",
};

const KEY = "business";

export async function getSettings(): Promise<Settings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row.value as object) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings, actorId: string): Promise<void> {
  const before = await getSettings();
  await db.$transaction([
    db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } }),
    db.auditLog.create({
      data: { actorId, action: "settings.update", entity: "settings", entityId: KEY, before, after: next },
    }),
  ]);
}
