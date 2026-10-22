import { getCurrentUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";

// The bell's data: unread count + the latest 20, for the signed-in person only.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ unread: 0, items: [] }, { status: 401 });
  const { items, unread } = await listNotifications(user.id);
  return Response.json(
    {
      unread,
      items: items.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: !!n.readAt, createdAt: n.createdAt.toISOString() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
