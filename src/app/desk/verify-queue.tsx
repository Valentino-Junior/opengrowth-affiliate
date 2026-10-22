import Link from "next/link";
import type { TxStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatTime, methodLabel } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { Card, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";

export function StatusPill({ status, reason }: { status: TxStatus; reason?: string | null }) {
  if (status === "verified") return <Pill tone="green">Verified</Pill>;
  if (status === "rejected") return <Pill tone="orange">Rejected{reason ? `: ${reason}` : ""}</Pill>;
  return <Pill tone="grey">Pending</Pill>;
}

const entryInclude = {
  player: { select: { handle: true } },
  affiliate: { select: { legalName: true } },
} as const;

/** Everything still pending (any day) plus everything logged today, newest first. */
export async function VerifyQueue({ userId, since }: { userId: string; since: Date }) {
  const entries = await db.transaction.findMany({
    where: { OR: [{ status: "pending" }, { createdAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    include: entryInclude,
    take: 200,
  });
  const staff = await db.staff.findMany({ where: { userId: { in: [...new Set(entries.map((e) => e.enteredBy))] } } });
  const who = (id: string) => {
    if (id === userId) return "You";
    const s = staff.find((x) => x.userId === id);
    return s ? s.displayCode : "Ops";
  };

  return (
    <Card id="queue" className="flex flex-col gap-4 !px-0">
      <div className="px-6">
        <h2 className="m-0 text-xl font-extrabold">Verify queue</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Check the amount, method and reference against the screenshot and the payment app. You can&apos;t verify your own entries.
        </p>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Time</Th>
            <Th>Player</Th>
            <Th>Affiliate</Th>
            <Th>Type</Th>
            <Th className="text-right">Amount</Th>
            <Th>Method</Th>
            <Th>Entered by</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? <EmptyRow cols={9}>Nothing logged today and nothing waiting.</EmptyRow> : null}
          {entries.map((e) => (
            <tr key={e.id}>
              <Td>{formatTime(e.createdAt)}</Td>
              <Td className="font-semibold">{e.player.handle}</Td>
              <Td className="whitespace-nowrap">{e.affiliate?.legalName ?? <span className="text-muted">None</span>}</Td>
              <Td className="capitalize">{e.type}</Td>
              <Td className="text-right font-bold">{formatCents(e.amountCents)}</Td>
              <Td className="whitespace-nowrap">{methodLabel(e.method)}</Td>
              <Td>{who(e.enteredBy)}</Td>
              <Td>
                <StatusPill status={e.status} reason={e.rejectReason} />
              </Td>
              <Td>
                {e.status !== "pending" ? (
                  <Link href={`/desk/entries/${e.id}`} className="text-sm text-muted">
                    View
                  </Link>
                ) : e.enteredBy === userId ? (
                  <span className="text-xs text-muted">Needs another teammate</span>
                ) : (
                  <div className="flex gap-2">
                    <Link
                      href={`/desk/entries/${e.id}`}
                      className="rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-bg no-underline"
                      aria-label={`Verify ${e.player.handle} ${e.type} ${formatCents(e.amountCents)}`}
                    >
                      Verify
                    </Link>
                    <Link
                      href={`/desk/entries/${e.id}#reject`}
                      className="rounded-full border border-red/50 px-4 py-1.5 text-sm font-bold text-red no-underline"
                    >
                      Reject
                    </Link>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="m-0 px-6 text-xs text-muted">
        Rejected entries need a reason and go back to whoever logged them. Edits after verification need an ops manager.
      </p>
    </Card>
  );
}

/** Entries this person logged that were rejected in the last 7 days: fix and log again. */
export async function MyRejected({ userId }: { userId: string }) {
  const entries = await db.transaction.findMany({
    where: { enteredBy: userId, status: "rejected", updatedAt: { gte: new Date(Date.now() - 7 * 864e5) } },
    orderBy: { updatedAt: "desc" },
    include: entryInclude,
  });
  if (entries.length === 0) return null;
  return (
    <Card tone="gold" className="flex flex-col gap-3">
      <h2 className="m-0 text-xl font-extrabold">Sent back to you</h2>
      <p className="m-0 text-sm text-muted">These were rejected. Check the payment app, then log them again correctly.</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{e.player.handle}</span>
            <span className="capitalize">{e.type}</span>
            <span className="font-bold">{formatCents(e.amountCents)}</span>
            <span className="text-muted">{methodLabel(e.method)} · {e.externalRef}</span>
            <Pill tone="orange">{e.rejectReason}</Pill>
          </li>
        ))}
      </ul>
    </Card>
  );
}
