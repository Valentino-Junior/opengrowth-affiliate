// In-app notifications behind the bell in the top bar.
// Sending never throws: a failed notification must not undo the action that triggered it.

import type { Role } from "@prisma/client";
import { db } from "./db";

export type NotificationInput = { kind: string; title: string; body?: string; href: string };

/** Notify specific people. */
export async function notify(userIds: (string | null | undefined)[], n: NotificationInput) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  try {
    await db.notification.createMany({ data: ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href })) });
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}

/** Notify everyone active in these roles, optionally leaving out the person who caused it. */
export async function notifyRoles(roles: Role[], n: NotificationInput, except?: string | null) {
  try {
    const users = await db.user.findMany({ where: { role: { in: roles }, status: "active", ...(except ? { id: { not: except } } : {}) }, select: { id: true } });
    await notify(
      users.map((u) => u.id),
      n,
    );
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}

export const STAFF_DESK: Role[] = ["employee", "ops"];
export const MANAGEMENT: Role[] = ["ops", "admin"];

export async function listNotifications(userId: string, take = 20) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markRead(userId: string, id: string) {
  await db.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
