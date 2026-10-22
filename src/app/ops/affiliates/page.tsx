import {
  approveAffiliateAction,
  declineAffiliateAction,
  registerAffiliateAction,
  tagPlayerAction,
} from "@/app/actions/people";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYMENT_METHODS, formatDateTime, methodLabel } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";

const statusTone = {
  pending_approval: "gold",
  active: "green",
  inactive: "grey",
  flagged: "orange",
  disqualified: "red",
} as const;

const DECLINE_REASONS = ["Duplicate person", "Details don't check out", "Other"];

export default async function AffiliatesPage() {
  await requireRole(AREA_ROLES.ops);
  const [pending, affiliates] = await Promise.all([
    db.affiliate.findMany({ where: { status: "pending_approval" }, orderBy: { createdAt: "asc" }, include: { user: true } }),
    db.affiliate.findMany({
      where: { status: { not: "pending_approval" } },
      orderBy: { referralCode: "asc" },
      include: { user: true, _count: { select: { players: { where: { linkStatus: "confirmed" } } } } },
    }),
  ]);

  return (
    <>
      <PageTitle eyebrow="OPS" title="Affiliates and players" lead={`${affiliates.length} affiliates · ${pending.length} waiting for approval`} />

      <Card id="approvals" tone={pending.length ? "gold" : "default"} className="flex flex-col gap-4 !px-0">
        <div className="px-6">
          <h2 className="m-0 text-xl font-extrabold">Waiting for approval</h2>
          <p className="m-0 mt-1 text-sm text-muted">Self-serve signups. Approving issues the next OG code.</p>
        </div>
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
                <Td>{a.user.email}</Td>
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
                      <SubmitButton variant="danger" className="!py-1.5">Decline</SubmitButton>
                    </ActionForm>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-7 lg:grid-cols-2">
        <Card id="register" className="flex flex-col gap-4">
          <div>
            <h2 className="m-0 text-xl font-extrabold">Register a new affiliate</h2>
            <p className="m-0 mt-1 text-sm text-muted">
              One person, one account. Email and phone are checked against every existing affiliate and player.
            </p>
          </div>
          <ActionForm action={registerAffiliateAction} resetOnSuccess className="flex flex-col gap-4">
            <Field label="Full legal name" name="legalName" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Phone number" name="phone" type="tel" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Payout method" name="payoutMethod" options={PAYMENT_METHODS} placeholder="Later" />
              <Field label="Payout handle" name="payoutHandle" />
            </div>
            <SubmitButton pendingText="Checking…">Check and create code</SubmitButton>
          </ActionForm>
        </Card>

        <Card id="tag" className="flex flex-col gap-4">
          <div>
            <h2 className="m-0 text-xl font-extrabold">Tag a new player</h2>
            <p className="m-0 mt-1 text-sm text-muted">Do this when the player signs up. Commission starts from their first deposit.</p>
          </div>
          <ActionForm action={tagPlayerAction} resetOnSuccess className="flex flex-col gap-4">
            <Field label="Player handle" name="handle" required />
            <Field label="Referral code" name="referralCode" placeholder="OG-A01" required />
            <Field label="Payment handle" name="paymentHandle" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" name="email" type="email" />
              <Field label="Phone" name="phone" type="tel" />
            </div>
            <SubmitButton pendingText="Linking…">Link player</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <Card id="all" className="!px-0">
        <h2 className="m-0 mb-3 px-6 text-xl font-extrabold">All affiliates</h2>
        <Table>
          <thead>
            <tr>
              <Th>Affiliate</Th>
              <Th>Code</Th>
              <Th>Players</Th>
              <Th>Payout</Th>
              <Th>ID</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {affiliates.length === 0 ? <EmptyRow cols={6}>No affiliates yet.</EmptyRow> : null}
            {affiliates.map((a) => (
              <tr key={a.id}>
                <Td className="font-semibold">{a.legalName}</Td>
                <Td className="text-gold">{a.referralCode ?? "—"}</Td>
                <Td>{a._count.players}</Td>
                <Td>{methodLabel(a.payoutMethod)}</Td>
                <Td>{a.idStatus === "verified" ? <Pill tone="green">Verified</Pill> : <Pill tone="grey">{a.idStatus}</Pill>}</Td>
                <Td>
                  <Pill tone={statusTone[a.status]}>{a.status.replace("_", " ")}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
