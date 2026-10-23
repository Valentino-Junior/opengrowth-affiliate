import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { localDay } from "@/lib/weeks";
import { PageTitle, Stat } from "@/components/ui";

// Ops overview: what's waiting, each card opening the tab where it's handled.
export default async function OpsOverviewPage() {
  await requireRole(AREA_ROLES.ops);
  const today = new Date(`${localDay(new Date())}T00:00:00Z`);

  const [ready, weeksToClose, flags, ids, approvals, prizes] = await Promise.all([
    db.affiliateWeek.aggregate({ where: { status: "ready" }, _sum: { payableCents: true }, _count: true }),
    db.week.count({ where: { status: "open", endsOn: { lt: today } } }),
    db.flag.findMany({ where: { status: "open" }, select: { playerId: true, id: true } }),
    db.idDocument.count({ where: { status: "submitted" } }),
    db.affiliate.count({ where: { status: "pending_approval" } }),
    db.raceResult.count({
      where: { rank: { lte: 3 }, prizeStatus: { not: "released" }, affiliate: { idStatus: "verified", status: { not: "flagged" } } },
    }),
  ]);
  // One review per player (an email and a phone match on the same player are one flag to look at).
  const flagReviews = new Set(flags.map((f) => f.playerId ?? f.id)).size;

  return (
    <>
      <PageTitle eyebrow="OPS" title="What needs you" lead="Everything waiting on management. Each card opens the tab where you deal with it." />
      <section aria-label="Waiting on ops" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {weeksToClose ? (
          <Stat label="Weeks to close" value={String(weeksToClose)} note="Ended but not closed yet" accent="gold" href="/ops/payouts" />
        ) : null}
        <Stat
          label="Payouts ready to send"
          value={formatCents(ready._sum.payableCents ?? 0n)}
          note={`${ready._count} affiliate${ready._count === 1 ? "" : "s"} · open the payout run`}
          accent={ready._count ? "gold" : undefined}
          href="/ops/payouts"
        />
        <Stat label="IDs to review" value={String(ids)} note="Open verification" accent={ids ? "gold" : undefined} href="/ops/verification" />
        <Stat label="Flags to review" value={String(flagReviews)} note="Possible self-referrals" accent={flagReviews ? "gold" : undefined} href="/ops/verification/flags" />
        <Stat label="Affiliates waiting for approval" value={String(approvals)} note="Open affiliates" accent={approvals ? "gold" : undefined} href="/ops/affiliates" />
        <Stat label="Prizes ready to release" value={String(prizes)} note="ID verified, not flagged" accent={prizes ? "gold" : undefined} href="/ops/verification/prizes" />
      </section>
    </>
  );
}
