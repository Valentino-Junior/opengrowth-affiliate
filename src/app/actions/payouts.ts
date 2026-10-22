"use server";

import { revalidatePath } from "next/cache";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { attempt, type ActionState } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { closeDueWeeks, markPaid, setChecklistItem } from "@/lib/payouts";

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
    await markPaid(str(form, "rowId"), user.id, str(form, "paymentRef"));
    revalidatePath("/ops/payouts");
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
