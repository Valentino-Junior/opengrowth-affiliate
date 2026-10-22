import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { methodLabel } from "@/lib/labels";
import { payoutCsv } from "@/lib/payouts";

// Export payout list: /ops/payouts/export?week=2026-10-12
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ops" && user.role !== "admin")) return new Response("Not found", { status: 404 });

  const startsOn = new URL(request.url).searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return new Response("Pass ?week=YYYY-MM-DD", { status: 400 });
  const week = await db.week.findUnique({ where: { startsOn: new Date(`${startsOn}T00:00:00Z`) } });
  if (!week) return new Response("No such week", { status: 404 });

  const rows = await db.affiliateWeek.findMany({
    where: { weekId: week.id },
    include: { affiliate: true },
    orderBy: { affiliate: { referralCode: "asc" } },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "payout.export", entity: "week", entityId: week.id } });

  return new Response(payoutCsv(rows, methodLabel), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="opengrowth-payouts-${startsOn}.csv"`,
    },
  });
}
