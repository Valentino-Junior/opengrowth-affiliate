import { db } from "@/lib/db";

// Health check for Docker / uptime monitors: the app is up and can reach the database.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
