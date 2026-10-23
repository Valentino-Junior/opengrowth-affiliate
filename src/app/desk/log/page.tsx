import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { DUPLICATE_REASON } from "@/lib/transactions";
import { dateToZonedLocal } from "@/lib/weeks";
import { Card, PageTitle } from "@/components/ui";
import { LogTransaction, type FixPrefill } from "../_components/log-transaction";
import { MyRejected } from "../_components/verify-queue";

export default async function DeskLogPage({ searchParams }: { searchParams: Promise<{ fix?: string; corrected?: string }> }) {
  const user = await requireRole(AREA_ROLES.desk);
  const { fix: fixId, corrected } = await searchParams;

  let fix: FixPrefill | null = null;
  if (fixId && /^[0-9a-f-]{36}$/.test(fixId)) {
    const e = await db.transaction.findUnique({ where: { id: fixId }, include: { player: true } });
    const mayFix = e && (e.enteredBy === user.id || user.role === "ops" || user.role === "admin");
    if (e && mayFix && e.status === "rejected" && !e.rejectionHandledAt && e.rejectReason !== DUPLICATE_REASON)
      fix = {
        id: e.id,
        type: e.type,
        playerHandle: e.player.handle,
        amount: (Number(e.amountCents) / 100).toFixed(2),
        method: e.method,
        externalRef: e.externalRef,
        occurredAt: dateToZonedLocal(e.occurredAt),
        reason: e.rejectReason ?? "no reason given",
        summary: `${formatCents(e.amountCents)} ${e.type} for ${e.player.handle}`,
      };
  }

  return (
    <>
      <PageTitle
        eyebrow="TRANSACTION DESK"
        title="Log a transaction"
        lead="Enter it exactly as it shows in the payment app. It goes to the verify queue, not straight to the books."
      />
      {corrected ? (
        <Card tone="green">
          <p className="m-0 text-sm">
            Correction logged: <strong>{corrected}</strong>. It&apos;s in the verify queue for a teammate to check.
          </p>
        </Card>
      ) : null}
      <MyRejected userId={user.id} fixingId={fix?.id} />
      {/* A new key per entry being fixed, so the form starts from that entry's details. */}
      <LogTransaction key={fix?.id ?? "new"} fix={fix} />
    </>
  );
}
