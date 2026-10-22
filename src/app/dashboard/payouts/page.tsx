import { AREA_ROLES, requireRole } from "@/lib/auth";
import { payoutHistory } from "@/lib/affiliate-stats";
import { formatCents } from "@/lib/money";
import { PayoutHistory } from "@/components/dashboard-bits";
import { Card, PageTitle, Stat } from "@/components/ui";

export default async function PayoutsPage() {
  const user = await requireRole(AREA_ROLES.affiliate);
  const affiliate = user.affiliate!;
  const rows = await payoutHistory(affiliate.id);
  const paid = rows.filter((r) => r.status === "paid").reduce((t, r) => t + r.payableCents, 0n);

  return (
    <>
      <PageTitle eyebrow="AFFILIATE DASHBOARD" title="Payouts" lead="Every Monday's payout, newest first." />
      <section aria-label="Totals" className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <Stat label="Paid to you so far" value={formatCents(paid)} accent="gold" />
        <Stat
          label="Carry-forward balance"
          value={formatCents(affiliate.carryForwardCents)}
          note="Comes off your next winning week"
          accent={affiliate.carryForwardCents === 0n ? "green" : undefined}
        />
      </section>
      <Card>
        <PayoutHistory rows={rows} />
      </Card>
    </>
  );
}
