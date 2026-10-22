"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { attempt, RuleError, type ActionState } from "@/lib/errors";
import { approveId, rejectId, submitId } from "@/lib/identity";
import { releasePrize } from "@/lib/race";
import { putImage } from "@/lib/storage";
import { db } from "@/lib/db";
import { MANAGEMENT, notify, notifyRoles } from "@/lib/notifications";

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

/** Affiliate uploads ID front + selfie. */
export async function submitIdAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.affiliate);
  const result = await attempt(async () => {
    if (!user.affiliate) throw new RuleError("No affiliate account.");
    if (form.get("consent") !== "on") throw new RuleError("Tick the box to confirm this is your own ID.");
    const frontKey = await putImage("ids", form.get("front") as File | null, "Photo of the ID");
    const selfieKey = await putImage("ids", form.get("selfie") as File | null, "Selfie holding the ID");
    await submitId(user.affiliate.id, { frontKey, selfieKey, nameOnId: str(form, "nameOnId") });
    await notifyRoles(MANAGEMENT, { kind: "id_submitted", title: `${user.affiliate.legalName} sent an ID to check`, href: "/ops/verification#ids" });
    revalidatePath("/dashboard");
    revalidatePath("/ops/verification");
  });
  if (result.error) return result;
  redirect("/dashboard?id=submitted");
}

export async function approveIdAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  if (form.get("nameMatches") !== "on") return { error: "Tick the box once the name on the ID matches the account." };
  return attempt(async () => {
    const doc = await db.idDocument.findUniqueOrThrow({ where: { id: str(form, "docId") }, include: { affiliate: true } });
    await approveId(doc.id, user.id);
    await notify([doc.affiliate.userId], { kind: "id_verified", title: "Your ID is verified", body: "Large payouts and Top 3 prizes are unlocked.", href: "/account" });
    revalidatePath("/ops/verification");
    revalidatePath("/ops/payouts");
  });
}

export async function rejectIdAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  return attempt(async () => {
    const doc = await db.idDocument.findUniqueOrThrow({ where: { id: str(form, "docId") }, include: { affiliate: true } });
    await rejectId(doc.id, user.id, str(form, "reason"));
    await notify([doc.affiliate.userId], { kind: "id_rejected", title: "Your ID was rejected", body: `Reason: ${str(form, "reason")}. Please upload it again.`, href: "/account" });
    revalidatePath("/ops/verification");
  });
}

export async function releasePrizeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  return attempt(async () => {
    await releasePrize(str(form, "resultId"), user.id);
    revalidatePath("/ops/verification");
    return { message: "Prize released." };
  });
}
