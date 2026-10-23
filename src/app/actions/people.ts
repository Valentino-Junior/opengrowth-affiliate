"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { LinkSource, PaymentMethod } from "@prisma/client";
import { AREA_ROLES, createSession, hashPassword, requireRole } from "@/lib/auth";
import {
  approveAffiliate,
  confirmPlayerLink,
  createAffiliate,
  createLinkedPlayer,
  declineAffiliate,
  rejectPlayerLink,
  resolveFlag,
  sendPlayerToOps,
} from "@/lib/people";
import { PAYMENT_METHODS } from "@/lib/labels";
import { attempt, type ActionState } from "@/lib/errors";
import { refreshAllHeldRows } from "@/lib/payouts";
import { LIMITS, allow, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { approvedMessage, declinedMessage, welcomeMessage } from "@/lib/email";
import { sendEmailCode } from "@/lib/verification";
import { MANAGEMENT, STAFF_DESK, notify, notifyRoles } from "@/lib/notifications";

const methodValues = PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]];
const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
const phoneSchema = z.string().refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a full phone number");

function firstIssue(e: z.ZodError) {
  return { error: e.issues[0].message };
}

// ---------- Affiliates ----------

const signupSchema = z.object({
  legalName: z.string().min(3, "Enter your full legal name (it must match your ID)"),
  email: z.string().email("Enter a valid email"),
  phone: phoneSchema,
  password: z.string().min(8, "Password: at least 8 characters"),
  payoutMethod: z.enum(methodValues, { errorMap: () => ({ message: "Pick how you want to be paid" }) }),
  payoutHandle: z.string().min(2, "Enter your payout handle (e.g. your $cashtag)"),
});

/** Public self-serve signup. The account waits for ops approval before a code is issued. */
export async function signupAffiliateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { limit, window } = LIMITS.affiliateSignupPerIp;
  if (!(await allow(`signup-affiliate:${await clientIp()}`, limit, window))) return { error: "Too many signups from this connection. Try again in an hour." };
  const parsed = signupSchema.safeParse(Object.fromEntries(["legalName", "email", "phone", "password", "payoutMethod", "payoutHandle"].map((k) => [k, str(form, k)])));
  if (!parsed.success) return firstIssue(parsed.error);
  const d = parsed.data;

  const result = await attempt(async () => {
    const { user } = await createAffiliate(
      { ...d, passwordHash: await hashPassword(d.password), payoutMethod: d.payoutMethod as never },
      { approve: false, actorId: null, revealOwner: false },
    );
    await createSession(user.id);
    await sendEmailCode(user);
    await notifyRoles(MANAGEMENT, { kind: "affiliate_signup", title: `${d.legalName} signed up as an affiliate`, body: "Waiting for your approval.", href: "/ops/affiliates/approvals" });
  });
  if (result.error) return result;
  redirect("/verify-email");
}

const registerSchema = z.object({
  legalName: z.string().min(3, "Enter the full legal name"),
  email: z.string().email("Enter a valid email"),
  phone: phoneSchema,
  payoutMethod: z.enum(methodValues).optional(),
  payoutHandle: z.string().optional(),
});

/** Ops registration: creates an active affiliate with a code and a one-time password to hand over. */
export async function registerAffiliateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  const parsed = registerSchema.safeParse({
    legalName: str(form, "legalName"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    payoutMethod: str(form, "payoutMethod") || undefined,
    payoutHandle: str(form, "payoutHandle") || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  return attempt(async () => {
    const tempPassword = randomBytes(6).toString("base64url");
    const { affiliate } = await createAffiliate(
      { ...parsed.data, payoutMethod: (parsed.data.payoutMethod as never) ?? null, passwordHash: await hashPassword(tempPassword) },
      { approve: true, actorId: user.id, revealOwner: true },
    );
    revalidatePath("/ops/affiliates", "layout");
    await welcomeMessage(parsed.data.email, affiliate.legalName, affiliate.referralCode!);
    return {
      message: `${affiliate.legalName} is registered.`,
      detail: { Code: affiliate.referralCode!, "Login email": parsed.data.email, "Temporary password": tempPassword },
    };
  });
}

export async function approveAffiliateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  const result = await attempt(async () => {
    const a = await approveAffiliate(str(form, "affiliateId"), user.id);
    revalidatePath("/ops/affiliates", "layout");
    const owner = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    const sent = await approvedMessage(owner.email, a.legalName, a.referralCode!);
    await notify([owner.id], { kind: "approved", title: `You're approved: your code is ${a.referralCode}`, body: "Share your code or link to start earning.", href: "/account" });
    return { message: `Approved ${a.legalName}: ${a.referralCode}.${sent.ok ? " We emailed them." : " The email couldn't be sent; tell them yourself."}` };
  });
  // The approved row leaves the waiting list (and its message with it), so report it at the top of the page.
  if (result.message) redirect(`/ops/affiliates/approvals?done=${encodeURIComponent(result.message)}`);
  return result;
}

export async function declineAffiliateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  const reason = str(form, "reason");
  if (!reason) return { error: "Pick a reason" };
  const result = await attempt(async () => {
    const affiliate = await db.affiliate.findUniqueOrThrow({ where: { id: str(form, "affiliateId") }, include: { user: true } });
    await declineAffiliate(affiliate.id, user.id, reason);
    revalidatePath("/ops/affiliates", "layout");
    await declinedMessage(affiliate.user.email, affiliate.legalName);
    return { message: `Declined ${affiliate.legalName}. We emailed them.` };
  });
  if (result.message) redirect(`/ops/affiliates/approvals?done=${encodeURIComponent(result.message)}`);
  return result;
}

// ---------- Players ----------

const playerSchema = z.object({
  handle: z.string().min(3, "Enter the player handle"),
  referralCode: z.string().min(3, "Enter the referral code"),
  email: z.union([z.literal(""), z.string().email("Enter a valid email")]),
  phone: z.union([z.literal(""), phoneSchema]),
  paymentHandle: z.string(),
  paymentMethod: z.union([z.literal(""), z.enum(methodValues)]),
});

async function addPlayer(form: FormData, source: LinkSource, actorId: string | null): Promise<ActionState> {
  const parsed = playerSchema.safeParse(
    Object.fromEntries(["handle", "referralCode", "email", "phone", "paymentHandle", "paymentMethod"].map((k) => [k, str(form, k)])),
  );
  if (!parsed.success) return firstIssue(parsed.error);
  if (source === "link" && (!parsed.data.email || !parsed.data.phone))
    return { error: "Enter your email and phone number" };
  const { paymentHandle, paymentMethod } = parsed.data;
  if (source === "link" && (!paymentMethod || !paymentHandle)) return { error: "Pick the app you deposit from and enter your handle on it" };
  if (paymentHandle && !paymentMethod) return { error: "Pick which app that payment handle is on" };
  if (paymentMethod && !paymentHandle) return { error: "Enter the payment handle for that app" };

  return attempt(async () => {
    const { player, affiliate, reasons } = await createLinkedPlayer(
      { ...parsed.data, paymentMethod: (paymentMethod || null) as PaymentMethod | null },
      parsed.data.referralCode,
      { source, actorId },
    );
    revalidatePath("/desk", "layout");
    revalidatePath("/ops/verification", "layout");
    if (source === "link")
      await notifyRoles(STAFF_DESK, {
        kind: "player_signup",
        title: `New player to confirm: ${player.handle}`,
        body: `Came through ${affiliate.referralCode} (${affiliate.legalName}).`,
        href: "/desk/new-players",
      });
    else if (reasons.length)
      await notifyRoles(MANAGEMENT, {
        kind: "flag",
        title: `Possible self-referral: ${player.handle}`,
        body: `Details match ${affiliate.legalName}'s own. Review the flag.`,
        href: "/ops/verification/flags",
      });
    if (source === "link") return { message: "You're in. Give your handle to the team when you make your first deposit." };
    if (reasons.length) return { message: `${player.handle} matches ${affiliate.legalName}'s own details. Sent to ops for review.` };
    return { message: `${player.handle} is linked to ${affiliate.legalName} (${affiliate.referralCode}).` };
  });
}

export async function playerSignupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { limit, window } = LIMITS.playerSignupPerIp;
  if (!(await allow(`signup-player:${await clientIp()}`, limit, window))) return { error: "Too many signups from this connection. Try again in an hour." };
  return addPlayer(form, "link", null);
}

export async function deskAddPlayerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  return addPlayer(form, "code_at_desk", user.id);
}

export async function tagPlayerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  return addPlayer(form, "ops_tag", user.id);
}

export async function confirmLinkAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  return attempt(async () => {
    await confirmPlayerLink(str(form, "playerId"), user.id);
    revalidatePath("/desk", "layout");
  });
}

export async function rejectLinkAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  const reason = str(form, "reason");
  if (!reason) return { error: "Pick a reason" };
  return attempt(async () => {
    await rejectPlayerLink(str(form, "playerId"), user.id, reason);
    revalidatePath("/desk", "layout");
  });
}

export async function sendToOpsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.desk);
  return attempt(async () => {
    const playerId = str(form, "playerId");
    await sendPlayerToOps(playerId, user.id);
    const sent = await db.player.findUnique({ where: { id: playerId }, include: { affiliate: true } });
    await notifyRoles(MANAGEMENT, {
      kind: "flag",
      title: `Possible self-referral: ${sent?.handle ?? "a player"}`,
      body: sent?.affiliate ? `The desk sent it to you. Details match ${sent.affiliate.legalName}'s own.` : "The desk sent it to you.",
      href: "/ops/verification/flags",
    });
    revalidatePath("/desk", "layout");
    revalidatePath("/ops/verification", "layout");
  });
}

// ---------- Flags ----------

export async function resolveFlagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(AREA_ROLES.ops);
  const decision = str(form, "decision");
  if (decision !== "clear" && decision !== "disqualify") return { error: "Pick Clear or Disqualify" };
  return attempt(async () => {
    await resolveFlag(str(form, "flagId"), decision, user.id, str(form, "note"));
    // Payout rows held for this flag can now become ready (or drop the disqualified player's money).
    await refreshAllHeldRows();
    revalidatePath("/ops/payouts");
    revalidatePath("/ops/verification", "layout");
    revalidatePath("/ops/affiliates", "layout");
  });
}
