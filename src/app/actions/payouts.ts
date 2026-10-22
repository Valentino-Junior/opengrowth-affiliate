"use server";

import { revalidatePath } from "next/cache";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { attempt, type ActionState } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { closeDueWeeks, markPaid, setChecklistItem } from "@/lib/payouts";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { formatWeekRange } from "@/lib/weeks";

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

export async function closeDueWeeksAction(): Promise<ActionState> {
  await requireRole(AREA_ROLES.ops);
  return attempt(async () => {
    const closed = await closeDueWeeks();
    revalidatePath("/ops/payouts");
    return { message: closed.length ? `Closed ${closed.length} week(s): ${closed.map((c) => `${c.rows} payout rows`).join(", ")}.` : "Nothing to close." };
  });
}

export async function markPaidAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  return attempt(async () => {
    const rowId = str(form, "rowId");
    await markPaid(rowId, user.id, str(form, "paymentRef"));
    revalidatePath("/ops/payouts");
    const row = await db.affiliateWeek.findUnique({ where: { id: rowId }, include: { affiliate: true, week: true } });
    if (row)
      await notify([row.affiliate.userId], {
        kind: "paid",
        title: `You were paid ${formatCents(row.payableCents)}`,
        body: `For the week of ${formatWeekRange({ startsOn: row.week.startsOn.toISOString().slice(0, 10), endsOn: row.week.endsOn.toISOString().slice(0, 10) })}.`,
        href: "/dashboard/payouts",
      });
    return { message: `Paid ${formatCents(BigInt(str(form, "amountCents") || "0"))}.` };
  });
}

export async function checklistAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  return attempt(async () => {
    await setChecklistItem(str(form, "weekId"), "payouts_sent", form.get("done") === "true", user.id);
    revalidatePath("/ops/payouts");
  });
}
