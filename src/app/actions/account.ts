"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, hashPassword, revokeOtherSessions, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { attempt, RuleError, type ActionState } from "@/lib/errors";
import { PAYMENT_METHODS } from "@/lib/labels";
import { updatePayoutDetails } from "@/lib/people";
import { allow } from "@/lib/rate-limit";

// Everything here changes only the signed-in person's own account.

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new RuleError("Your session ended. Log in again.");
  return user;
}

/** Wrong current passwords are limited, so this form can't be used to guess a password. */
async function checkCurrentPassword(userId: string, hash: string | null, password: string) {
  if (!(await allow(`pw-check:${userId}`, 10, 15 * 60))) throw new RuleError("Too many attempts. Wait 15 minutes and try again.");
  if (!password) throw new RuleError("Enter your current password.");
  if (!hash || !(await verifyPassword(password, hash))) throw new RuleError("Your current password is wrong.");
}

export async function updateNameAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await me();
    const name = str(form, "name").replace(/\s+/g, " ");
    if (name.length < 3) throw new RuleError("Enter at least 3 characters.");
    if (name.length > 80) throw new RuleError("That name is too long.");

    if (user.affiliate) {
      // The legal name has to match the ID used for payouts and prizes.
      if (user.affiliate.idStatus === "verified" || user.affiliate.idStatus === "submitted")
        throw new RuleError("Your name is locked because it must match your ID. Message the team to change it.");
      await db.affiliate.update({ where: { id: user.affiliate.id }, data: { legalName: name } });
      await db.auditLog.create({
        data: { actorId: user.id, action: "account.name", entity: "affiliate", entityId: user.affiliate.id, before: { name: user.affiliate.legalName }, after: { name } },
      });
    } else if (user.staff) {
      await db.staff.update({ where: { id: user.staff.id }, data: { displayName: name } });
      await db.auditLog.create({
        data: { actorId: user.id, action: "account.name", entity: "staff", entityId: user.staff.id, before: { name: user.staff.displayName }, after: { name } },
      });
    }
    revalidatePath("/", "layout");
    return { message: "Name saved." };
  });
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await me();
    const current = String(form.get("currentPassword") ?? "");
    const next = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    await checkCurrentPassword(user.id, user.passwordHash, current);
    if (next.length < 8) throw new RuleError("New password: at least 8 characters.");
    if (next !== confirm) throw new RuleError("The two new passwords don't match.");
    if (next === current) throw new RuleError("Choose a password different from your current one.");

    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
    await revokeOtherSessions(user.id);
    await db.auditLog.create({ data: { actorId: user.id, action: "account.password", entity: "user", entityId: user.id } });
    return { message: "Password changed. You've been signed out on your other devices." };
  });
}

export async function updatePayoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await me();
    if (!user.affiliate) throw new RuleError("Only affiliates have payout details.");
    const method = PAYMENT_METHODS.find((m) => m.value === str(form, "payoutMethod"))?.value;
    if (!method) throw new RuleError("Pick how you want to be paid.");
    await checkCurrentPassword(user.id, user.passwordHash, String(form.get("currentPassword") ?? ""));

    const { flagged } = await updatePayoutDetails(user.affiliate.id, method, str(form, "payoutHandle"), user.id);
    revalidatePath("/account");
    return {
      message: flagged
        ? "Payout details saved. This handle matches one of your players, so the team will review it before your next payout."
        : "Payout details saved. Your next payout goes here.",
    };
  });
}
