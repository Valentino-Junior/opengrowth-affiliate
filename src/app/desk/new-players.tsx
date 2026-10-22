import { confirmLinkAction, deskAddPlayerAction, rejectLinkAction, sendToOpsAction } from "@/app/actions/people";
import { db } from "@/lib/db";
import { formatTime } from "@/lib/labels";
import { selfReferralReasons } from "@/lib/people";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { PayoutFields } from "@/components/payout-fields";

const REJECT_REASONS = [
  { value: "Already a player", label: "Already a player" },
  { value: "Wrong referral code", label: "Wrong referral code" },
  { value: "Fake or test signup", label: "Fake or test signup" },
  { value: "Other", label: "Other" },
];

export async function pendingPlayerCount() {
  return db.player.count({ where: { linkStatus: "pending" } });
}

/** Desk panel: players who came through an affiliate link, waiting for an employee to confirm the link. */
export async function NewPlayers() {
  const players = await db.player.findMany({
    where: { linkStatus: "pending" },
    orderBy: { createdAt: "desc" },
    include: { affiliate: { include: { user: true } } },
  });

  return (
    <Card id="new" className="flex flex-col gap-5 !px-0">
      <div className="px-6">
        <h2 className="m-0 text-xl font-extrabold">New players from affiliate links</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Players who signed up through a link are tagged automatically. Confirm the link before their first deposit is logged.
        </p>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Player</Th>
            <Th>Came through</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Payment handle</Th>
            <Th>Signed up</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {players.length === 0 ? <EmptyRow cols={7}>No new players waiting. You&apos;re all caught up.</EmptyRow> : null}
          {players.map((p) => {
            const reasons = p.affiliate ? selfReferralReasons(p, p.affiliate) : [];
            const match = (r: string, has: boolean) =>
              !has ? <span className="text-muted">—</span> : reasons.includes(r as never) ? <Pill tone="orange">Matches affiliate</Pill> : <Pill tone="green">Unique</Pill>;
            return (
              <tr key={p.id}>
                <Td className="font-semibold">{p.handle}</Td>
                <Td>
                  <span className="text-gold">{p.affiliate?.referralCode}</span> → {p.affiliate?.legalName}
                </Td>
                <Td>{match("email_match", !!p.email)}</Td>
                <Td>{match("phone_match", !!p.phone)}</Td>
                <Td>{match("payment_handle_match", !!p.paymentHandle)}</Td>
                <Td>{formatTime(p.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap items-start gap-2">
                    {reasons.length ? (
                      <ActionForm action={sendToOpsAction} hidden={{ playerId: p.id }}>
                        <SubmitButton variant="ghost" className="!py-1.5 text-orange">Send to ops</SubmitButton>
                      </ActionForm>
                    ) : (
                      <ActionForm action={confirmLinkAction} hidden={{ playerId: p.id }}>
                        <SubmitButton className="!py-1.5">Confirm link</SubmitButton>
                      </ActionForm>
                    )}
                    <ActionForm action={rejectLinkAction} hidden={{ playerId: p.id }} className="flex flex-wrap items-center gap-2">
                      <select
                        name="reason"
                        required
                        defaultValue=""
                        aria-label={`Reason to reject ${p.handle}`}
                        className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-ink"
                      >
                        <option value="" disabled>
                          Reason…
                        </option>
                        {REJECT_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="danger" className="!py-1.5">Reject</SubmitButton>
                    </ActionForm>
                  </div>
                  {reasons.length ? (
                    <p className="m-0 mt-2 text-xs text-orange">
                      {p.handle}&apos;s details match their affiliate&apos;s account: likely a self-referral.
                    </p>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="border-t border-line px-6 pt-5">
        <h3 className="m-0 text-base font-extrabold">Add a player who gave a code at the desk</h3>
        <p className="m-0 mt-1 mb-4 text-sm text-muted">The link is confirmed as you add it, unless the details match the affiliate.</p>
        <ActionForm action={deskAddPlayerAction} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Player handle" name="handle" required />
          <Field label="Referral code" name="referralCode" placeholder="OG-A01" required />
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
          <div className="sm:col-span-2">
            <PayoutFields forPlayer required={false} emptyHint="Optional. The account the player deposits from." />
          </div>
          {/* lines the button up with the inputs (label height + gap) */}
          <div className="sm:col-span-2 sm:pt-[26px]">
            <SubmitButton pendingText="Adding…">Add player</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </Card>
  );
}
