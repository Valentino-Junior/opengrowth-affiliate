"use server";

import { revalidatePath } from "next/cache";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { dollarsToCents } from "@/lib/money";
import { getSettings, saveSettings, settingsSchema } from "@/lib/settings";

export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireRole(AREA_ROLES.admin);
  const current = await getSettings();
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const cents = (k: string) => Number(dollarsToCents(text(k)));

  let next;
  try {
    const ratePercent = Number(text("ratePercent"));
    if (!Number.isFinite(ratePercent)) throw new Error("Commission rate must be a number");
    next = {
      commissionRateBp: Math.round(ratePercent * 100),
      minPayoutCents: cents("minPayout"),
      idThresholdCents: cents("idThreshold"),
      badgeThresholds: current.badgeThresholds.map((b, i) => ({ name: b.name, minCents: cents(`badge${i}`) })),
      prizes: { first: text("prize1"), second: text("prize2"), third: text("prize3") },
      groupChatUrl: text("groupChatUrl"),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Check the values" };
  }

  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const asc = parsed.data.badgeThresholds.every((b, i, all) => i === 0 || b.minCents > all[i - 1].minCents);
  if (!asc) return { error: "Each badge threshold must be higher than the one before it." };

  await saveSettings(parsed.data, user.id);
  revalidatePath("/", "layout");
  return { saved: true };
}
