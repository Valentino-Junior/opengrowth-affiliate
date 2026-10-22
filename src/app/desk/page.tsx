import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { localDay, zonedLocalToDate } from "@/lib/weeks";
import { Card, PageTitle, Stat } from "@/components/ui";
import { pendingPlayerCount } from "./_components/new-players";

// Desk overview: who's on shift and what's waiting. Each card opens the tab where you act on it.
export default async function DeskOverviewPage() {
  const user = await requireRole(AREA_ROLES.desk);
  const staff = user.staff;
  // "Today" = since midnight, New York time.
  const since = zonedLocalToDate(`${localDay(new Date())}T00:00`);

  const [waiting, newPlayers, verifiedByMe, rejectedByMe, sentBack] = await Promise.all([
    db.transaction.count({ where: { status: "pending" } }),
    pendingPlayerCount(),
    db.transaction.count({ where: { status: "verified", verifiedBy: user.id, verifiedAt: { gte: since } } }),
    db.auditLog.count({ where: { action: "transaction.reject", actorId: user.id, at: { gte: since } } }),
    db.transaction.count({ where: { enteredBy: user.id, status: "rejected", updatedAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
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
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-bg">{staff.displayCode}</span>
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

      {sentBack ? (
        <Stat
          label="Sent back to you"
          value={String(sentBack)}
          note={`${sentBack === 1 ? "An entry you logged was" : "Entries you logged were"} rejected. Fix and log again.`}
          accent="gold"
          href="/desk/log"
        />
      ) : null}

      <section aria-label="Shift numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Stat label="Waiting for verification" value={String(waiting)} accent="gold" note="Open the verify queue" href="/desk/queue" />
        <Stat label="New players to confirm" value={String(newPlayers)} note="Open new players" href="/desk/new-players" />
        <Stat label="Verified by you today" value={String(verifiedByMe)} accent="green" />
        <Stat label="Rejected by you today" value={String(rejectedByMe)} />
      </section>
    </>
  );
}
