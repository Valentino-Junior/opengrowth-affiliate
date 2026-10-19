import Link from "next/link";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { playersForWeek } from "@/lib/affiliate-stats";
import { formatCents } from "@/lib/money";
import { formatWeekRange, weekFor } from "@/lib/weeks";
import { PlayersTable } from "@/components/dashboard-bits";
import { Card, PageTitle } from "@/components/ui";

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireRole(AREA_ROLES.affiliate);
  const affiliate = user.affiliate!;
  const { week } = await searchParams;

  // This week and the 7 before it.
  const weeks = Array.from({ length: 8 }, (_, i) => weekFor(new Date(Date.now() - i * 7 * 864e5)));
  const selected = weeks.find((w) => w.startsOn === week) ?? weeks[0];
  const rows = await playersForWeek(affiliate.id, selected);
  const total = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((t, r) => t + f(r), 0n);

  return (
    <>
      <PageTitle
        eyebrow="AFFILIATE DASHBOARD"
        title="My players"
        lead={`${rows.length} players linked to you. Only verified deposits and cashouts are shown.`}
      />
      <nav aria-label="Week" className="flex flex-wrap gap-1 text-sm">
        {weeks.map((w, i) => (
          <Link
            key={w.startsOn}
            href={`/dashboard/players?week=${w.startsOn}`}
            className={`rounded-full px-3 py-1.5 no-underline ${w.startsOn === selected.startsOn ? "bg-surface text-ink" : "text-muted"}`}
          >
            {i === 0 ? "This week" : formatWeekRange(w)}
          </Link>
        ))}
      </nav>
      <Card className="!px-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-6">
          <h2 className="m-0 text-xl font-extrabold">Week of {formatWeekRange(selected)}</h2>
          <span className="text-sm text-muted">
            {formatCents(total((r) => r.depositsCents), { whole: true })} deposits − {formatCents(total((r) => r.cashoutsCents), { whole: true })} cashouts ={" "}
            <strong className="text-ink">{formatCents(total((r) => r.grossCents), { whole: true })}</strong>
          </span>
        </div>
        <PlayersTable rows={rows} empty="No confirmed players yet." />
      </Card>
    </>
  );
}
