import Link from "next/link";
import { notFound } from "next/navigation";
import { editTransactionAction, rejectTransactionAction, verifyTransactionAction } from "@/app/actions/transactions";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYMENT_METHODS, formatDateTime, methodLabel } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { fileUrl } from "@/lib/storage";
import { formatWeekRange } from "@/lib/weeks";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle } from "@/components/ui";
import { StatusPill } from "../../_components/verify-queue";
import { ImageViewer } from "@/components/image-viewer";

const REJECT_REASONS = ["Ref not found in the app", "Wrong amount", "Wrong payment method", "Wrong player", "Duplicate entry", "Screenshot doesn't match", "Other"];

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(AREA_ROLES.desk);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const entry = await db.transaction.findUnique({
    where: { id },
    include: { player: true, affiliate: true, week: true, edits: { orderBy: { createdAt: "desc" } } },
  });
  if (!entry) notFound();

  const people = await db.user.findMany({
    where: { id: { in: [entry.enteredBy, entry.verifiedBy, ...entry.edits.map((e) => e.editedBy)].filter(Boolean) as string[] } },
    include: { staff: true },
  });
  const name = (uid: string | null) => {
    if (!uid) return "—";
    if (uid === user.id) return "You";
    const p = people.find((x) => x.id === uid);
    return p?.staff ? `${p.staff.displayName} (${p.staff.displayCode})` : (p?.email ?? "—");
  };

  const mine = entry.enteredBy === user.id;
  const canReview = entry.status === "pending" && !mine;
  const canEdit = entry.status === "verified" && (user.role === "ops" || user.role === "admin");
  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusPill key="s" status={entry.status} reason={entry.rejectReason} />],
    ["Type", <span key="t" className="capitalize">{entry.type}</span>],
    ["Amount", <span key="a" className="text-2xl font-extrabold">{formatCents(entry.amountCents)}</span>],
    ["Payment method", methodLabel(entry.method)],
    ["Transaction ID", <span key="r" className="font-mono">{entry.externalRef}</span>],
    ["Player", entry.player.handle],
    ["Affiliate", entry.affiliate ? `${entry.affiliate.legalName} (${entry.affiliate.referralCode})` : "None"],
    ["When it happened", formatDateTime(entry.occurredAt)],
    ["Logged", `${formatDateTime(entry.createdAt)} by ${name(entry.enteredBy)}`],
    ...(entry.verifiedAt ? ([["Verified", `${formatDateTime(entry.verifiedAt)} by ${name(entry.verifiedBy)}`]] as [string, string][]) : []),
    ...(entry.week ? ([["Counts in week", formatWeekRange({ startsOn: day(entry.week.startsOn), endsOn: day(entry.week.endsOn) })]] as [string, string][]) : []),
  ];

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/desk/queue" className="text-sm text-muted">
          ← Back to the verify queue
        </Link>
        <PageTitle eyebrow="TRANSACTION DESK" title={`${entry.type === "deposit" ? "Deposit" : "Cashout"} · ${entry.player.handle}`} />
      </div>

      <div className="grid gap-7 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="m-0 text-xl font-extrabold">Screenshot</h2>
          <ImageViewer
            src={fileUrl(entry.screenshotKey)}
            alt={`Payment screenshot for ${entry.player.handle}`}
            thumbClassName="max-h-[560px] w-full rounded-[10px] border border-line bg-bg object-contain"
          />
          <span className="text-xs text-muted">Click to open full size.</span>
        </Card>

        <div className="flex flex-col gap-7">
          <Card>
            <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="m-0">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {mine && entry.status === "pending" ? (
            <Card tone="gold">
              <p className="m-0 text-sm">You logged this entry, so another teammate has to verify it.</p>
            </Card>
          ) : null}

          {canReview ? (
            <>
              <Card className="flex flex-col gap-3">
                <h2 className="m-0 text-xl font-extrabold">Verify</h2>
                <ActionForm action={verifyTransactionAction} hidden={{ transactionId: entry.id }} className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="checked" className="mt-0.5 h-4 w-4 accent-[#d4af5a]" />
                    The amount, payment method and transaction ID match the screenshot and the payment app.
                  </label>
                  <div>
                    <SubmitButton pendingText="Verifying…">Verify entry</SubmitButton>
                  </div>
                </ActionForm>
              </Card>
              <Card id="reject" className="flex flex-col gap-3">
                <h2 className="m-0 text-xl font-extrabold">Reject</h2>
                <ActionForm action={rejectTransactionAction} hidden={{ transactionId: entry.id }} className="flex flex-col gap-3">
                  <Select label="Reason" name="reason" options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Choose…" required />
                  <Field label="If Other, what's wrong?" name="otherReason" />
                  <div>
                    <SubmitButton variant="danger" pendingText="Rejecting…">Reject entry</SubmitButton>
                  </div>
                </ActionForm>
              </Card>
            </>
          ) : null}

          {canEdit ? (
            <Card className="flex flex-col gap-3">
              <h2 className="m-0 text-xl font-extrabold">Edit verified entry</h2>
              <p className="m-0 text-sm text-muted">Ops only. The old values are kept in the history.</p>
              <ActionForm action={editTransactionAction} hidden={{ transactionId: entry.id }} className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Type"
                  name="type"
                  defaultValue={entry.type}
                  options={[
                    { value: "deposit", label: "Deposit" },
                    { value: "cashout", label: "Cashout" },
                  ]}
                />
                <Field label="Amount (USD)" name="amount" defaultValue={(Number(entry.amountCents) / 100).toFixed(2)} required />
                <Select label="Payment method" name="method" defaultValue={entry.method} options={PAYMENT_METHODS} />
                <Field label="Transaction ID" name="externalRef" defaultValue={entry.externalRef} required />
                <div className="sm:col-span-2">
                  <Field label="Why is it changing?" name="reason" required />
                </div>
                <div className="sm:col-span-2">
                  <SubmitButton pendingText="Saving…">Save change</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ) : null}

          {entry.edits.length ? (
            <Card className="flex flex-col gap-3">
              <h2 className="m-0 text-xl font-extrabold">Edit history</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                {entry.edits.map((e) => {
                  const before = e.before as Record<string, string>;
                  const after = e.after as Record<string, string>;
                  const changed = Object.keys(after).filter((k) => before[k] !== after[k]);
                  const show = (k: string, v: string) => (k === "amountCents" ? formatCents(BigInt(v)) : k === "method" ? methodLabel(v as never) : v);
                  return (
                    <li key={e.id} className="border-t border-line-soft pt-3">
                      <div className="text-muted">
                        {formatDateTime(e.createdAt)} · {name(e.editedBy)} · “{e.reason}”
                      </div>
                      {changed.map((k) => (
                        <div key={k}>
                          {k === "amountCents" ? "Amount" : k === "externalRef" ? "Transaction ID" : k === "method" ? "Method" : "Type"}:{" "}
                          <s className="text-muted">{show(k, before[k])}</s> → <strong>{show(k, after[k])}</strong>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
