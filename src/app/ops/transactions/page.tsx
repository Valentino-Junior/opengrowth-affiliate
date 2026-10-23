import Link from "next/link";
import type { TxStatus } from "@prisma/client";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, methodLabel } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { Card, PageTitle, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { TxTypeLabel } from "@/components/tx-type";
import { StatusPill } from "@/app/desk/_components/verify-queue";

const FILTERS: { key: "all" | TxStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

// Every deposit and cashout, read-only. Opening one lets ops edit it once verified (only ops may).
export default async function OpsTransactionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(AREA_ROLES.ops);
  const { status } = await searchParams;
  const filter = FILTERS.find((f) => f.key === status)?.key ?? "all";

  const entries = await db.transaction.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { player: { select: { handle: true } }, affiliate: { select: { legalName: true } } },
  });
  const staff = await db.staff.findMany({ where: { userId: { in: [...new Set(entries.map((e) => e.enteredBy))] } } });
  const code = (id: string) => staff.find((s) => s.userId === id)?.displayCode ?? "Ops";

  return (
    <>
      <PageTitle
        eyebrow="OPS"
        title="Transactions"
        lead="Every deposit and cashout logged at the desk, newest first. Open one to see its screenshot and history; verified entries can be corrected here."
      />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/ops/transactions" : `/ops/transactions?status=${f.key}`}
            aria-current={f.key === filter ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold no-underline ${
              f.key === filter ? "border-gold bg-gold/10 text-ink" : "border-line text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Card className="!px-0 !pt-2">
        <Table>
          <thead>
            <tr>
              <Th>Logged</Th>
              <Th>Player</Th>
              <Th>Affiliate</Th>
              <Th>Type</Th>
              <Th className="text-right">Amount</Th>
              <Th>Method</Th>
              <Th>Entered by</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? <EmptyRow cols={9}>No entries here.</EmptyRow> : null}
            {entries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                <Td className="font-semibold">{e.player.handle}</Td>
                <Td className="whitespace-nowrap">{e.affiliate?.legalName ?? <span className="text-muted">None</span>}</Td>
                <Td>
                  <TxTypeLabel type={e.type} />
                  {e.replacesId ? (
                    <span className="ml-2">
                      <Pill tone="blue">Correction</Pill>
                    </span>
                  ) : null}
                </Td>
                <Td className="text-right font-bold">{formatCents(e.amountCents)}</Td>
                <Td className="whitespace-nowrap">{methodLabel(e.method)}</Td>
                <Td>{code(e.enteredBy)}</Td>
                <Td>
                  <StatusPill status={e.status} reason={e.rejectReason} />
                </Td>
                <Td>
                  <Link href={`/ops/entries/${e.id}`} className="text-sm text-muted" aria-label={`Open ${e.player.handle} ${e.type} ${formatCents(e.amountCents)}`}>
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
