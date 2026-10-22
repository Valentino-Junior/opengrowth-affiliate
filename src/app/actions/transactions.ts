"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMethod, TxType } from "@prisma/client";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { attempt, RuleError, type ActionState } from "@/lib/errors";
import { PAYMENT_METHODS } from "@/lib/labels";
import { dollarsToCents, formatCents } from "@/lib/money";
import { putImage } from "@/lib/storage";
import { editVerifiedTransaction, logTransaction, rejectTransaction, verifyTransaction } from "@/lib/transactions";
import { zonedLocalToDate } from "@/lib/weeks";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

function parseType(v: string): TxType {
  if (v !== "deposit" && v !== "cashout") throw new RuleError("Pick Deposit or Cashout.");
  return v;
}

function parseMethod(v: string): PaymentMethod {
  const m = PAYMENT_METHODS.find((x) => x.value === v);
  if (!m) throw new RuleError("Pick the payment method.");
  return m.value;
}

function parseAmount(v: string): bigint {
  try {
    return dollarsToCents(v);
  } catch {
    throw new RuleError("Enter the amount in dollars, e.g. 200 or 49.99.");
  }
}

export async function logTransactionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  return attempt(async () => {
    const type = parseType(str(form, "type"));
    const method = parseMethod(str(form, "method"));
    const amountCents = parseAmount(str(form, "amount"));
    const when = str(form, "occurredAt");
    const occurredAt = when ? zonedLocalToDate(when) : new Date();
    // Upload first: if the image is rejected, nothing is written to the books.
    const screenshotKey = await putImage("screenshots", form.get("screenshot") as File | null, "Payment screenshot");

    const { player, entry } = await logTransaction(
      { type, method, amountCents, occurredAt, playerHandle: str(form, "playerHandle"), externalRef: str(form, "externalRef"), screenshotKey },
      user.id,
    );
    revalidatePath("/desk", "layout");
    return { message: `Logged ${formatCents(entry.amountCents)} ${type} for ${player.handle}. It's in the verify queue.` };
  });
}

export async function verifyTransactionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  if (form.get("checked") !== "on") return { error: "Tick the box once the amount, method and reference match the screenshot." };
  const result = await attempt(async () => {
    await verifyTransaction(str(form, "transactionId"), user.id);
    revalidatePath("/desk", "layout");
  });
  if (result.error) return result;
  redirect("/desk/queue");
}

export async function rejectTransactionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  const reason = str(form, "reason") === "Other" ? str(form, "otherReason") : str(form, "reason");
  if (!reason) return { error: "Pick a reason (or describe it under Other)." };
  const result = await attempt(async () => {
    const id = str(form, "transactionId");
    await rejectTransaction(id, user.id, reason);
    revalidatePath("/desk", "layout");
    const entry = await db.transaction.findUnique({ where: { id }, include: { player: true } });
    if (entry)
      await notify([entry.enteredBy], {
        kind: "entry_rejected",
        title: `Your ${formatCents(entry.amountCents)} ${entry.type} for ${entry.player.handle} was rejected`,
        body: `Reason: ${reason}. Fix it and log it again.`,
        href: "/desk/log",
      });
  });
  if (result.error) return result;
  redirect("/desk/queue");
}

export async function editTransactionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  const id = str(form, "transactionId");
  return attempt(async () => {
    await editVerifiedTransaction(
      id,
      {
        type: parseType(str(form, "type")),
        method: parseMethod(str(form, "method")),
        amountCents: parseAmount(str(form, "amount")),
        externalRef: str(form, "externalRef"),
      },
      user,
      str(form, "reason"),
    );
    revalidatePath(`/desk/entries/${id}`);
    revalidatePath("/desk", "layout");
    return { message: "Entry updated. The change is in the history below." };
  });
}
