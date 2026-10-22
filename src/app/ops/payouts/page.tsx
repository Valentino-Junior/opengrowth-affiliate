import Link from "next/link";
import type { AffiliateWeekStatus } from "@prisma/client";
import { checklistAction, closeDueWeeksAction } from "@/app/actions/payouts";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { FLAG_REASON_LABEL, formatDateTime, methodLabel } from "@/lib/labels";
import { formatCents, formatRate } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatWeekRange, localDay } from "@/lib/weeks";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle, Pill, Stat } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { MarkPaid } from "./mark-paid";
import { IdChecks } from "./id-checks";

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
  const [rows, pendingPlayers, pendingEntries, openFlags] = await Promise.all([
    db.affiliateWeek.findMany({ where: { weekId: week.id }, include: { affiliate: true }, orderBy: { affiliate: { referralCode: "asc" } } }),
    db.player.count({ where: { linkStatus: { in: ["pending", "sent_to_ops"] } } }),
    db.transaction.count({ where: { status: "pending", occurredAt: { lt: new Date(week.endsOn.getTime() + 2 * 864e5) } } }),
    db.flag.findMany({ where: { status: "open" }, include: { affiliate: true, player: true } }),
  ]);

  const heldFlags = openFlags.filter((f) => rows.some((r) => r.affiliateId === f.affiliateId && r.status === "flagged"));
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((t, r) => t + f(r), 0n);
  const readyCents = sum((r) => (r.status === "ready" ? r.payableCents : 0n));
  const paidCents = sum((r) => (r.status === "paid" ? r.payableCents : 0n));
  const carriedCount = rows.filter((r) => r.status === "carried" || r.status === "under_minimum").length;
  const reviewCount = rows.filter((r) => r.status === "flagged" || r.status === "needs_id").length;
  const manual = week.checklist as Record<string, boolean>;
  const rate = formatRate(week.rateBp ?? settings.commissionRateBp);
  const payDay = new Date(`${ymd(week.payoutDate)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const checklist: { label: string; done: boolean; auto: boolean }[] = [
    { label: "All new players tagged and confirmed", done: pendingPlayers === 0, auto: true },
    { label: "Verify queue on the transaction desk is empty", done: pendingEntries === 0, auto: true },
    { label: "Week closed and totals calculated from verified entries", done: true, auto: true },
    { label: "Flags reviewed (shared payment handles, self-referrals)", done: openFlags.length === 0, auto: true },
    { label: `ID verified for payouts over ${formatCents(week.idThresholdCents ?? 0n, { whole: true })} and prize winners`, done: !rows.some((r) => r.status === "needs_id"), auto: true },
    { label: "Payouts sent by each affiliate's method", done: !!manual.payouts_sent, auto: false },
    { label: "Rows marked paid and carry-forwards logged", done: !rows.some((r) => r.status === "ready"), auto: true },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle
          eyebrow="MONDAY PAYOUT RUN"
          title={`Week of ${formatWeekRange(bounds)}`}
          lead={`Pay out ${payDay} · Commission rate ${rate} · Minimum payout ${formatCents(week.minPayoutCents ?? 0n, { whole: true })}`}
        />
        <div className="flex flex-wrap items-center gap-3">
          {runWeeks.length > 1 ? (
            <nav aria-label="Other weeks" className="flex flex-wrap gap-1 text-sm">
              {runWeeks.slice(0, 6).map((w) => (
                <Link
                  key={w.id}
                  href={`/ops/payouts?week=${ymd(w.startsOn)}`}
                  className={`rounded-full px-3 py-1.5 no-underline ${w.id === week.id ? "bg-surface text-ink" : "text-muted"}`}
                >
                  {formatWeekRange({ startsOn: ymd(w.startsOn), endsOn: ymd(w.endsOn) })}
                </Link>
              ))}
            </nav>
          ) : null}
          <a href={`/ops/payouts/export?week=${bounds.startsOn}`} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink no-underline hover:border-muted">
            Export payout list
          </a>
        </div>
      </div>

      {closeBanner}

      <section aria-label="Run summary" className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <Stat label="Gross profit from referred players" value={formatCents(sum((r) => r.grossProfitCents), { whole: true })} />
        <Stat label="Ready to pay" value={formatCents(readyCents)} note={paidCents ? `${formatCents(paidCents)} already paid` : undefined} accent="gold" />
        <Stat label="Carried or under minimum" value={String(carriedCount)} />
        <Stat label="Needs review" value={String(reviewCount)} accent={reviewCount ? undefined : "green"} />
      </section>

      <Card className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-extrabold">Monday checklist</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${c.done ? "border-green bg-green text-bg" : "border-line text-transparent"}`}
              >
                ✓
              </span>
              <span className={c.done ? "text-ink" : "text-muted"}>
                {c.label}
                <span className="sr-only">{c.done ? " (done)" : " (not done)"}</span>
              </span>
              {!c.auto ? (
                <ActionForm action={checklistAction} hidden={{ weekId: week.id, done: String(!c.done) }}>
                  <SubmitButton variant="ghost" className="!px-3 !py-1 text-xs">
                    {c.done ? "Undo" : "Tick"}
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3 !px-0">
        <div className="px-6">
          <h2 className="m-0 text-xl font-extrabold">Affiliate payouts</h2>
          <p className="m-0 mt-1 text-sm text-muted">
            Net = gross profit + carry-forward. Commission = {rate} of net, never below $0. Amounts under the minimum roll into the next payout.
          </p>
        </div>
        {heldFlags.length ? (
          <div role="note" className="mx-6 flex flex-col gap-1 rounded-[10px] border border-red/40 bg-red/10 px-4 py-3 text-sm">
            {heldFlags.map((f) => (
              <span key={f.id}>
                <strong>{f.affiliate.legalName}</strong> is on hold: {FLAG_REASON_LABEL[f.reason].toLowerCase()}
                {f.player ? ` (player ${f.player.handle})` : ""}. Review the flag before paying.
              </span>
            ))}
          </div>
        ) : null}
        <Table>
          <thead>
            <tr>
              <Th>Affiliate</Th>
              <Th className="text-right">Players</Th>
              <Th className="text-right">Gross profit</Th>
              <Th className="text-right">Carry-forward</Th>
              <Th className="text-right">Net</Th>
              <Th className="text-right">Commission</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow cols={9}>No affiliate had verified activity this week.</EmptyRow> : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="font-semibold whitespace-nowrap">{r.affiliate.legalName}</Td>
                <Td className="text-right">{r.playerCount}</Td>
                <Td className="text-right">{formatCents(r.grossProfitCents, { whole: true })}</Td>
                <Td className={`text-right ${r.carryInCents < 0n ? "text-orange" : ""}`}>{formatCents(r.carryInCents, { whole: true })}</Td>
                <Td className="text-right">{formatCents(r.netCents, { whole: true })}</Td>
                <Td className="text-right font-bold">
                  {formatCents(r.commissionCents)}
                  {r.rolledInCents > 0n ? <span className="block text-xs font-normal text-muted">+{formatCents(r.rolledInCents)} rolled in</span> : null}
                </Td>
                <Td className="whitespace-nowrap">{methodLabel(r.affiliate.payoutMethod)}</Td>
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
                    <Link href="/ops/verification" className="rounded-full border border-red/50 px-4 py-1.5 text-sm font-bold text-red no-underline">
                      Review
                    </Link>
                  ) : r.status === "needs_id" ? (
                    <Link href="/ops/verification#ids" className="rounded-full border border-orange/50 px-4 py-1.5 text-sm font-bold text-orange no-underline">
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
      <IdChecks weekId={week.id} thresholdCents={week.idThresholdCents ?? 0n} />
    </>
  );
}
