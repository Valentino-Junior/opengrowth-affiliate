import { approveIdAction, rejectIdAction, releasePrizeAction } from "@/app/actions/verification";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { monthLabel } from "@/lib/race";
import { fileUrl } from "@/lib/storage";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { IdStatusPill } from "@/components/id-status";

const ID_REJECT_REASONS = ["Name doesn't match the account", "Photo unreadable or cut off", "ID expired", "Selfie doesn't match the ID", "Other"];

const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

function Thumb({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-28 w-44 rounded-[8px] border border-line bg-bg object-cover" />
    </a>
  );
}

/** Ops compares the ID photos with the account's legal name, then approves or rejects. */
export async function IdReview() {
  const docs = await db.idDocument.findMany({ where: { status: "submitted" }, orderBy: { createdAt: "asc" }, include: { affiliate: true } });
  return (
    <Card id="ids" tone={docs.length ? "gold" : "default"} className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-xl font-extrabold">ID review</h2>
        <p className="m-0 mt-1 text-sm text-muted">The name on the ID must match the account. Approving unlocks large payouts and prizes.</p>
      </div>
      {docs.length === 0 ? <p className="m-0 text-sm text-muted">No IDs waiting.</p> : null}
      {docs.map((d) => {
        const match = sameName(d.nameOnId, d.affiliate.legalName);
        return (
          <div key={d.id} className="flex flex-wrap gap-5 border-t border-line pt-4" aria-label={`ID for ${d.affiliate.legalName}`}>
            <div className="flex gap-3">
              <Thumb src={fileUrl(d.frontKey)} alt={`ID front for ${d.affiliate.legalName}`} />
              <Thumb src={fileUrl(d.selfieKey)} alt={`Selfie for ${d.affiliate.legalName}`} />
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Account</dt>
              <dd className="m-0 font-bold">
                {d.affiliate.legalName} <span className="text-gold">{d.affiliate.referralCode}</span>
              </dd>
              <dt className="text-muted">Name on ID</dt>
              <dd className="m-0">
                {d.nameOnId} {match ? <Pill tone="green">Matches</Pill> : <Pill tone="orange">Different</Pill>}
              </dd>
              <dt className="text-muted">Sent</dt>
              <dd className="m-0">{formatDateTime(d.createdAt)}</dd>
            </dl>
            <div className="flex flex-col gap-3">
              <ActionForm action={approveIdAction} hidden={{ docId: d.id }} className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="nameMatches" className="h-4 w-4 accent-[#d4af5a]" />
                  Name on the ID matches the account
                </label>
                <div>
                  <SubmitButton className="!py-1.5">Approve ID</SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={rejectIdAction} hidden={{ docId: d.id }} className="flex flex-wrap items-center gap-2">
                <select
                  name="reason"
                  required
                  defaultValue=""
                  aria-label={`Reason to reject ${d.affiliate.legalName}'s ID`}
                  className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-ink"
                >
                  <option value="" disabled>
                    Reason…
                  </option>
                  {ID_REJECT_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <SubmitButton variant="danger" className="!py-1.5">
                  Reject ID
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

/** Prizes for the most recent settled race month. */
export async function PrizeRelease() {
  const race = await db.raceMonth.findFirst({
    where: { status: { not: "live" } },
    orderBy: { month: "desc" },
    include: { results: { where: { rank: { lte: 3 } }, orderBy: { rank: "asc" }, include: { affiliate: true } } },
  });
  if (!race) return null;
  const prizes = [race.prize1, race.prize2, race.prize3];
  const month = race.month.toISOString().slice(0, 10);

  return (
    <Card id="prizes" className="flex flex-col gap-3 !px-0">
      <div className="px-6">
        <h2 className="m-0 text-xl font-extrabold">Top 3 prizes · {monthLabel(month)}</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Release a prize only after the winner&apos;s ID is verified. A flagged winner waits until the flag is cleared.
        </p>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Place</Th>
            <Th>Affiliate</Th>
            <Th className="text-right">Gross profit</Th>
            <Th>Prize</Th>
            <Th>ID</Th>
            <Th>Prize status</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {race.results.length === 0 ? <EmptyRow cols={7}>No affiliate had verified profit that month.</EmptyRow> : null}
          {race.results.map((r) => {
            const ready = r.prizeStatus !== "released" && r.affiliate.idStatus === "verified" && r.affiliate.status !== "flagged";
            return (
              <tr key={r.id}>
                <Td className="font-serif text-xl text-gold">{r.rank}</Td>
                <Td className="font-semibold">{r.affiliate.legalName}</Td>
                <Td className="text-right">{formatCents(r.grossProfitCents, { whole: true })}</Td>
                <Td>{prizes[(r.rank ?? 1) - 1]}</Td>
                <Td>
                  <IdStatusPill status={r.affiliate.idStatus} audience="ops" />
                </Td>
                <Td>
                  {r.prizeStatus === "released" ? (
                    <Pill tone="green">Released</Pill>
                  ) : r.affiliate.status === "flagged" ? (
                    <Pill tone="red">On hold: flagged</Pill>
                  ) : ready ? (
                    <Pill tone="gold">Ready to release</Pill>
                  ) : (
                    <Pill tone="grey">Waiting for ID</Pill>
                  )}
                </Td>
                <Td>
                  {ready ? (
                    <ActionForm action={releasePrizeAction} hidden={{ resultId: r.id }}>
                      <SubmitButton className="!py-1.5" aria-label={`Release prize to ${r.affiliate.legalName}`}>
                        Release prize
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
