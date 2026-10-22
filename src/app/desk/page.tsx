import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { localDay, zonedLocalToDate } from "@/lib/weeks";
import { Card, PageTitle, Stat } from "@/components/ui";
import { NewPlayers, pendingPlayerCount } from "./new-players";
import { LogTransaction } from "./log-transaction";
import { MyRejected, VerifyQueue } from "./verify-queue";

export default async function DeskPage() {
  const user = await requireRole(AREA_ROLES.desk);
  const staff = user.staff;
  // "This shift" = since midnight today, New York time.
  const since = zonedLocalToDate(`${localDay(new Date())}T00:00`);

  const [waiting, newPlayers, verifiedByMe, rejectedByMe] = await Promise.all([
    db.transaction.count({ where: { status: "pending" } }),
    pendingPlayerCount(),
    db.transaction.count({ where: { status: "verified", verifiedBy: user.id, verifiedAt: { gte: since } } }),
    db.auditLog.count({ where: { action: "transaction.reject", actorId: user.id, at: { gte: since } } }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle
          eyebrow="TRANSACTION DESK"
          title="Log it. Verify it. Then it counts."
          lead="Only verified deposits and cashouts count toward an affiliate's gross profit. Every entry needs a second team member to verify it."
        />
        {staff ? (
          <Card className="flex items-center gap-3 !p-3 !pr-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-bg">
              {staff.displayCode}
            </span>
            <span className="flex flex-col">
              <span className="font-bold">{staff.displayName}</span>
              <span className="text-xs text-muted">
                {staff.team}
                {staff.shiftStart ? ` · ${staff.shiftStart}–${staff.shiftEnd} shift` : ""}
              </span>
            </span>
          </Card>
        ) : null}
      </div>

      <section aria-label="Shift numbers" className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat label="Waiting for verification" value={String(waiting)} accent="gold" />
        <Stat label="New players to confirm" value={String(newPlayers)} />
        <Stat label="Verified by you today" value={String(verifiedByMe)} accent="green" />
        <Stat label="Rejected by you today" value={String(rejectedByMe)} />
      </section>

      <MyRejected userId={user.id} />
      <NewPlayers />
      <LogTransaction />
      <VerifyQueue userId={user.id} since={since} />
    </>
  );
}
