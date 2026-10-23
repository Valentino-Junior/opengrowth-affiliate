import Link from "next/link";
import type { AffiliateWeekStatus } from "@prisma/client";
import { closeDueWeeksAction } from "@/app/actions/payouts";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, methodLabel } from "@/lib/labels";
import { formatCents, formatRate } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatWeekRange, localDay } from "@/lib/weeks";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle, Pill, Stat } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { MarkPaid } from "./mark-paid";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const STATUS: Record<AffiliateWeekStatus, { label: string; tone: "green" | "gold" | "orange" | "grey" | "red" }> = {
  ready: { label: "Ready", tone: "gold" },
  paid: { label: "Paid", tone: "green" },
  carried: { label: "Carried", tone: "orange" },
  under_minimum: { label: "Under minimum", tone: "grey" },
  flagged: { label: "Flagged", tone: "red" },
  needs_id: { label: "Needs ID", tone: "orange" },
};

export default async function PayoutRunPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await requireRole(AREA_ROLES.ops);
  const settings = await getSettings();
  const { week: weekParam } = await searchParams;
  const today = new Date(`${localDay(new Date())}T00:00:00Z`);

  const [runWeeks, dueCount] = await Promise.all([
    db.week.findMany({ where: { status: { not: "open" } }, orderBy: { startsOn: "desc" }, take: 12 }),
    db.week.count({ where: { status: "open", endsOn: { lt: today } } }),
  ]);
  const week = runWeeks.find((w) => ymd(w.startsOn) === weekParam) ?? runWeeks[0];

  const closeBanner =
    dueCount > 0 ? (
      <Card tone="gold" className="flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 text-sm">
          {dueCount === 1 ? "Last week has" : `${dueCount} weeks have`} ended but {dueCount === 1 ? "isn't" : "aren't"} closed yet. The worker
          closes weeks automatically after Sunday 23:59; you can close now.
        </p>
        <ActionForm action={closeDueWeeksAction} className="flex flex-col gap-2">
          <SubmitButton pendingText="Closing…">Close week now</SubmitButton>
        </ActionForm>
      </Card>
    ) : null;

  if (!week)
    return (
      <>
        <PageTitle eyebrow="MONDAY PAYOUT RUN" title="No closed weeks yet" lead="The first payout run appears after the first week closes." />
        {closeBanner}
      </>
    );

  const bounds = { startsOn: ymd(week.startsOn), endsOn: ymd(week.endsOn) };
  const [rows, pendingEntries, openFlags] = await Promise.all([
    db.affiliateWeek.findMany({ where: { weekId: week.id }, include: { affiliate: true }, orderBy: { affiliate: { referralCode: "asc" } } }),
    db.transaction.count({ where: { status: "pending", occurredAt: { lt: new Date(week.endsOn.getTime() + 2 * 864e5) } } }),
    db.flag.count({ where: { status: "open" } }),
  ]);

  // Rows with something to pay (or something stopping it) come first; carried and under-minimum rows pay nothing this week.
  const toPay = rows.filter((r) => r.status !== "carried" && r.status !== "under_minimum");
  const nothingDue = rows.filter((r) => r.status === "carried" || r.status === "under_minimum");
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((t, r) => t + f(r), 0n);
  const readyCents = sum((r) => (r.status === "ready" ? r.payableCents : 0n));
  const paidCents = sum((r) => (r.status === "paid" ? r.payableCents : 0n));
  const readyCount = rows.filter((r) => r.status === "ready").length;
  const onHold = rows.filter((r) => r.status === "flagged" || r.status === "needs_id").length;
  const rate = formatRate(week.rateBp ?? settings.commissionRateBp);
  const payDay = new Date(`${ymd(week.payoutDate)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  // Only what's still in the way. Each line disappears once it's done.
  const blockers = [
    pendingEntries ? { text: `${pendingEntries} ${pendingEntries === 1 ? "entry is" : "entries are"} still waiting in the desk's verify queue.` } : null,
    openFlags ? { text: `${openFlags} open ${openFlags === 1 ? "flag" : "flags"} to review.`, href: "/ops/verification/flags", link: "Review flags" } : null,
  ].filter((b) => b !== null);

  const idx = runWeeks.findIndex((w) => w.id === week.id);
  const weekLink = (w: (typeof runWeeks)[number] | undefined, label: string) =>
    w ? (
      <Link href={`/ops/payouts?week=${ymd(w.startsOn)}`} className="text-sm text-muted no-underline hover:text-ink">
        {label}
      </Link>
    ) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle
          eyebrow="MONDAY PAYOUT RUN"
          title={`Week of ${formatWeekRange(bounds)}`}
          lead={`Pay out ${payDay} · Commission ${rate} · Minimum ${formatCents(week.minPayoutCents ?? 0n, { whole: true })}`}
        />
        <div className="flex flex-wrap items-center gap-4">
          {weekLink(runWeeks[idx + 1], "← Earlier week")}
          {weekLink(runWeeks[idx - 1], "Later week →")}
          <a href={`/ops/payouts/export?week=${bounds.startsOn}`} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink no-underline hover:border-muted">
            Export payout list
          </a>
        </div>
      </div>

      {closeBanner}

      {blockers.length ? (
        <Card tone="gold" className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-extrabold">Before you pay</h2>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
            {blockers.map((b) => (
              <li key={b.text}>
                {b.text}
                {b.href ? (
                  <>
                    {" "}
                    <Link href={b.href}>{b.link}</Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section aria-label="Run summary" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={`Ready to pay · ${readyCount} ${readyCount === 1 ? "affiliate" : "affiliates"}`} value={formatCents(readyCents)} accent="gold" />
        <Stat label="Paid" value={formatCents(paidCents)} accent={paidCents && !readyCount ? "green" : undefined} />
        <Stat label="On hold" value={String(onHold)} note={onHold ? "Flag or ID to clear first" : undefined} />
      </section>

      <Card className="!px-0 !pt-2">
        <Table>
          <thead>
            <tr>
              <Th>Affiliate</Th>
              <Th className="text-right">Pay</Th>
              <Th>Send to</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {toPay.length === 0 ? <EmptyRow cols={5}>Nobody is owed a payout this week.</EmptyRow> : null}
            {toPay.map((r) => (
              <tr key={r.id}>
                <Td className="font-semibold whitespace-nowrap">{r.affiliate.legalName}</Td>
                <Td className="text-right font-bold">
                  {formatCents(r.status === "ready" || r.status === "paid" ? r.payableCents : r.commissionCents)}
                  {r.rolledInCents > 0n ? <span className="block text-xs font-normal text-muted">incl. {formatCents(r.rolledInCents)} rolled in</span> : null}
                </Td>
                <Td className="whitespace-nowrap">
                  {methodLabel(r.affiliate.payoutMethod)}
                  {r.affiliate.payoutHandle ? <span className="text-muted"> · {r.affiliate.payoutHandle}</span> : null}
                </Td>
                <Td>
                  <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                </Td>
                <Td>
                  {r.status === "ready" ? (
                    <MarkPaid
                      rowId={r.id}
                      amountCents={String(r.payableCents)}
                      amount={formatCents(r.payableCents)}
                      method={`${methodLabel(r.affiliate.payoutMethod)}${r.affiliate.payoutHandle ? ` (${r.affiliate.payoutHandle})` : ""}`}
                      name={r.affiliate.legalName}
                    />
                  ) : r.status === "flagged" ? (
                    <Link href="/ops/verification/flags" className="rounded-full border border-red/50 px-4 py-1.5 text-sm font-bold text-red no-underline">
                      Review
                    </Link>
                  ) : r.status === "needs_id" ? (
                    <Link href="/ops/verification" className="rounded-full border border-orange/50 px-4 py-1.5 text-sm font-bold text-orange no-underline">
                      Verify ID
                    </Link>
                  ) : r.status === "paid" ? (
                    <span className="text-xs text-muted">
                      {r.paidAt ? formatDateTime(r.paidAt) : ""}
                      {r.paymentRef ? ` · ${r.paymentRef}` : ""}
                    </span>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {nothingDue.length ? (
        <details className="rounded-card border border-line bg-surface px-6 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            Nothing to pay this week: {nothingDue.length} {nothingDue.length === 1 ? "affiliate" : "affiliates"}
          </summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-sm">
            {nothingDue.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{r.affiliate.legalName}</span>
                <span className="text-muted">
                  {r.status === "carried"
                    ? `${formatCents(r.netCents, { whole: true })} net loss carries into next week`
                    : `${formatCents(r.commissionCents)} is under the minimum and rolls into the next payout`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
