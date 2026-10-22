import Link from "next/link";
import type { TxStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatTime, methodLabel } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { Card, Pill } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { dismissRejectionAction } from "@/app/actions/transactions";
import { DUPLICATE_REASON, fixHref } from "@/lib/transactions";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { TxTypeLabel } from "@/components/tx-type";

export function StatusPill({ status, reason }: { status: TxStatus; reason?: string | null }) {
  if (status === "verified") return <Pill tone="green">Verified</Pill>;
  if (status === "rejected") return <Pill tone="orange">Rejected{reason ? `: ${reason}` : ""}</Pill>;
  return <Pill tone="blue">Pending</Pill>; // in progress: waiting for a second employee
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
    <Card id="queue" className="flex flex-col gap-4 !px-0 !pt-2">
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
    </Card>
  );
}

/** Entries this person logged that were rejected in the last 7 days: fix and log again. */
/**
 * Entries this person logged that were rejected and not yet dealt with (last 30 days).
 * Each one is fixed (re-logged from a pre-filled form) or dismissed; then it leaves the list.
 */
export async function MyRejected({ userId, fixingId }: { userId: string; fixingId?: string | null }) {
  const entries = await db.transaction.findMany({
    where: { enteredBy: userId, status: "rejected", rejectionHandledAt: null, updatedAt: { gte: new Date(Date.now() - 30 * 864e5) } },
    orderBy: { updatedAt: "desc" },
    include: entryInclude,
  });
  if (entries.length === 0) return null;
  return (
    <Card tone="gold" className="flex flex-col gap-3">
      <h2 className="m-0 text-xl font-extrabold">Sent back to you</h2>
      <p className="m-0 text-sm text-muted">
        These were rejected. Fix and log again if the details were wrong; dismiss it if there&apos;s nothing to redo (a duplicate is already in the books).
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {entries.map((e) => {
          const duplicate = e.rejectReason === DUPLICATE_REASON;
          return (
            <li key={e.id} className={`flex flex-wrap items-center gap-3 border-t border-line-gold py-3 text-sm first:border-t-0 ${e.id === fixingId ? "opacity-60" : ""}`}>
              <span className="font-semibold">{e.player.handle}</span>
              <TxTypeLabel type={e.type} />
              <span className="font-bold">{formatCents(e.amountCents)}</span>
              <span className="text-muted">
                {methodLabel(e.method)} · {e.externalRef}
              </span>
              <Pill tone="orange">{e.rejectReason}</Pill>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {e.id === fixingId ? (
                  <span className="text-xs font-semibold text-gold">Fixing below</span>
                ) : duplicate ? null : (
                  <Link href={`${fixHref(e.id)}#log`} className="rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-bg no-underline">
                    Fix and log again
                  </Link>
                )}
                <ActionForm action={dismissRejectionAction} hidden={{ transactionId: e.id }}>
                  <SubmitButton variant="ghost" className="!py-1.5" aria-label={`Dismiss ${e.player.handle} ${formatCents(e.amountCents)} ${e.type}`}>
                    Dismiss
                  </SubmitButton>
                </ActionForm>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
