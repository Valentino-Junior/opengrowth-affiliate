import { approveAffiliateAction, declineAffiliateAction } from "@/app/actions/people";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, methodLabel } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Pill } from "@/components/ui";
import { Notice } from "@/components/notice";
import { EmptyRow, Table, Td, Th } from "@/components/table";

const DECLINE_REASONS = ["Duplicate person", "Details don't check out", "Other"];

// Self-serve signups. Approving issues the next OG code.
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireRole(AREA_ROLES.ops);
  const { done } = await searchParams;
  const pending = await db.affiliate.findMany({ where: { status: "pending_approval" }, orderBy: { createdAt: "asc" }, include: { user: true } });

  return (
    <>
      {done ? (
        <Notice param="done">
          <p className="m-0 text-sm">{done}</p>
        </Notice>
      ) : null}

      <Card className="flex flex-col gap-4 !px-0">
        <p className="m-0 px-6 text-sm text-muted">Self-serve signups. Approving issues the next OG code.</p>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Payout</Th>
              <Th>Signed up</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? <EmptyRow cols={6}>Nobody is waiting.</EmptyRow> : null}
            {pending.map((a) => (
              <tr key={a.id}>
                <Td className="font-semibold">{a.legalName}</Td>
                <Td>
                  <span className="flex flex-col gap-1">
                    {a.user.email}
                    {a.user.emailVerifiedAt ? <Pill tone="green">Email confirmed</Pill> : <Pill tone="gold">Email not confirmed</Pill>}
                  </span>
                </Td>
                <Td>{a.user.phone}</Td>
                <Td>
                  {methodLabel(a.payoutMethod)} · {a.payoutHandle}
                </Td>
                <Td>{formatDateTime(a.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap items-start gap-2">
                    <ActionForm action={approveAffiliateAction} hidden={{ affiliateId: a.id }}>
                      <SubmitButton className="!py-1.5">Approve</SubmitButton>
                    </ActionForm>
                    <ActionForm action={declineAffiliateAction} hidden={{ affiliateId: a.id }} className="flex flex-wrap items-center gap-2">
                      <select
                        name="reason"
                        required
                        defaultValue=""
                        aria-label={`Reason to decline ${a.legalName}`}
                        className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-ink"
                      >
                        <option value="" disabled>
                          Reason…
                        </option>
                        {DECLINE_REASONS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <SubmitButton variant="danger" className="!py-1.5">
                        Decline
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

    </>
  );
}
