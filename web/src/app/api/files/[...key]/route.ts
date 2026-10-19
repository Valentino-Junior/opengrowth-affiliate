import { getCurrentUser } from "@/lib/auth";
import { getFile } from "@/lib/storage";

// Private files. Payment screenshots: desk staff, ops, admin. ID photos: ops and admin only.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  const key = (await params).key.join("/");
  const allowed =
    user &&
    (key.startsWith("screenshots/")
      ? ["employee", "ops", "admin"].includes(user.role)
      : key.startsWith("ids/") && ["ops", "admin"].includes(user.role));
  if (!allowed) return new Response("Not found", { status: 404 });

  const file = await getFile(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
