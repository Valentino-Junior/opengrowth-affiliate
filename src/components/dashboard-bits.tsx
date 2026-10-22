// Pieces of the affiliate dashboard, matching the original dashboard design.

import type { AffiliateWeek, Week } from "@prisma/client";
import { formatCents, formatSignedCents } from "@/lib/money";
import type { PlayerWeekRow } from "@/lib/affiliate-stats";
import { Pill } from "./ui";
import { EmptyRow, Table, Td, Th } from "./table";

export function StatusBadge({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-line-gold bg-surface-gold py-2.5 pr-5 pl-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-bg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 18h20l-2-11-5 4-3-7-3 7-5-4z" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[11px] tracking-[1.5px] text-muted">STATUS</span>
        <span className="text-[15px] font-extrabold text-gold">{name}</span>
      </span>
    </div>
  );
}

export function MathStrip(p: { deposits: bigint; cashouts: bigint; gross: bigint; rate: string; commission: bigint }) {
  const term = (label: string, value: string, tone = "text-ink") => (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xl font-extrabold ${tone}`}>{value}</span>
    </div>
  );
  const op = (s: string) => <span className="text-xl text-muted">{s}</span>;
  return (
    <section aria-label="How this week is calculated" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line bg-surface px-6 py-5">
      <span className="w-full text-xs font-bold tracking-[3px] text-gold">THIS WEEK&apos;S MATH</span>
      {term("Deposits", formatCents(p.deposits, { whole: true }))}
      {op("−")}
      {term("Cashouts", formatCents(p.cashouts, { whole: true }))}
      {op("=")}
      {/* Colour carries meaning only here: green for a winning week, orange for a losing one. */}
      {term("Gross profit", formatCents(p.gross, { whole: true }), p.gross > 0n ? "text-green" : p.gross < 0n ? "text-orange" : "text-ink")}
      {op("×")}
      {term("Your cut", p.rate)}
      {op("=")}
      {term("Commission", formatCents(p.commission), "text-gold")}
    </section>
  );
}

const monthYear = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "America/New_York" });

export function PlayersTable({ rows, empty }: { rows: PlayerWeekRow[]; empty: string }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Player</Th>
          <Th>Joined</Th>
          <Th className="text-right">Deposits</Th>
          <Th className="text-right">Cashouts</Th>
          <Th className="text-right">Gross profit</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow cols={5}>{empty}</EmptyRow> : null}
        {rows.map((p) => (
          <tr key={p.id}>
            <Td className="font-semibold">{p.handle}</Td>
            <Td className="text-muted">{monthYear(p.joined)}</Td>
            <Td className="text-right">{formatCents(p.depositsCents, { whole: true })}</Td>
            <Td className="text-right">{formatCents(p.cashoutsCents, { whole: true })}</Td>
            <Td className={`text-right font-bold ${p.grossCents > 0n ? "text-green" : p.grossCents < 0n ? "text-orange" : ""}`}>
              {formatSignedCents(p.grossCents)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

type HistoryRow = AffiliateWeek & { week: Week };

const payDay = (w: Week) =>
  new Date(`${w.payoutDate.toISOString().slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function describe(r: HistoryRow): { line: string; amount: string; status: React.ReactNode } {
  const gross = formatCents(r.grossProfitCents, { whole: true });
  const line =
    r.netCents < 0n && r.grossProfitCents < 0n && r.carryInCents === 0n
      ? `${gross} losing week`
      : r.carryInCents < 0n
        ? `${gross} profit − ${formatCents(-r.carryInCents, { whole: true })} carried`
        : `${gross} gross profit`;
  const amount = formatCents(r.payableCents);
  switch (r.status) {
    case "paid":
      return { line, amount, status: <Pill tone="green">Paid</Pill> };
    case "carried":
      return { line, amount: "$0.00", status: <Pill tone="orange">Carried forward</Pill> };
    case "under_minimum":
      return { line, amount, status: <Pill tone="grey">Rolls into next payout</Pill> };
    case "ready":
      return { line, amount, status: <Pill tone="gold">Being paid</Pill> };
    default:
      return { line, amount, status: <Pill tone="orange">On hold</Pill> };
  }
}

export function PayoutHistory({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) return <p className="m-0 py-6 text-sm text-muted">No payouts yet. Your first one comes the Monday after your players&apos; first week.</p>;
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map((r) => {
        const d = describe(r);
        return (
          <li key={r.id} className="flex items-center justify-between gap-4 border-t border-line-soft py-3 first:border-t-0">
            <span className="flex flex-col">
              <span className="font-semibold">{payDay(r.week)}</span>
              <span className="text-xs text-muted">{d.line}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="font-extrabold">{d.amount}</span>
              {d.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
