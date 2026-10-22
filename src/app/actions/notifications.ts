"use server";

import { getCurrentUser } from "@/lib/auth";
import { markAllRead, markRead } from "@/lib/notifications";

export async function markNotificationReadAction(id: string) {
  const user = await getCurrentUser();
  if (user) await markRead(user.id, id);
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();
  if (user) await markAllRead(user.id);
}
