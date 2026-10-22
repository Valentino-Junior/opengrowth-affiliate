import Link from "next/link";
import { logTransactionAction } from "@/app/actions/transactions";
import { db } from "@/lib/db";
import { PAYMENT_METHODS } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import { FileField } from "@/components/file-field";
import { PlayerPicker } from "@/components/player-picker";

/** The rejected entry being fixed: its details start the form, and the new entry is linked to it. */
export type FixPrefill = {
  id: string;
  type: "deposit" | "cashout";
  playerHandle: string;
  amount: string;
  method: string;
  externalRef: string;
  occurredAt: string; // datetime-local, New York time
  reason: string;
  summary: string; // "$200.00 deposit for player07"
};

export async function LogTransaction({ fix }: { fix?: FixPrefill | null }) {
  // Players money can be logged for: link settled (confirmed, or rejected = no affiliate).
  const players = await db.player.findMany({
    where: { linkStatus: { in: ["confirmed", "rejected"] } },
    select: { handle: true, affiliate: { select: { legalName: true } }, linkStatus: true },
    orderBy: { handle: "asc" },
    take: 2000,
  });

  return (
    <Card id="log" className="flex scroll-mt-8 flex-col gap-4">
      {fix ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line-gold bg-surface-gold px-4 py-3 text-sm">
          <span>
            Fixing the rejected <strong>{fix.summary}</strong>. It was rejected for: <strong>{fix.reason}</strong>. Correct the details, attach the right
            screenshot and submit.
          </span>
          <Link href="/desk/log" className="font-semibold text-muted">
            Cancel
          </Link>
        </div>
      ) : null}
      <ActionForm action={logTransactionAction} resetOnSuccess hidden={fix ? { replacesId: fix.id } : undefined} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 p-0 text-sm font-semibold text-ink-soft">Type</legend>
          <div className="flex rounded-full border border-line bg-bg p-1">
            {[
              ["deposit", "Deposit"],
              ["cashout", "Cashout"],
            ].map(([value, label], i) => (
              <label
                key={value}
                className="flex-1 cursor-pointer rounded-full px-4 py-1.5 text-center text-sm font-bold text-muted has-[:checked]:bg-gold has-[:checked]:text-bg"
              >
                <input type="radio" name="type" value={value} defaultChecked={fix ? fix.type === value : i === 0} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <PlayerPicker
          label="Player handle"
          name="playerHandle"
          players={players.map((p) => ({ handle: p.handle, affiliate: p.linkStatus === "confirmed" ? (p.affiliate?.legalName ?? null) : null }))}
          defaultValue={fix?.playerHandle}
        />
        <Field label="Amount (USD)" name="amount" inputMode="decimal" placeholder="200.00" defaultValue={fix?.amount} required />
        <Select label="Payment method" name="method" options={PAYMENT_METHODS} placeholder="Choose…" defaultValue={fix?.method ?? ""} required />
        <Field label="Transaction ID / reference" name="externalRef" autoComplete="off" defaultValue={fix?.externalRef} required />
        <Field
          label="When (New York time)"
          name="occurredAt"
          type="datetime-local"
          hint="Click to pick the date and time. Leave empty for right now."
          data-max-now="America/New_York"
          defaultValue={fix?.occurredAt}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <FileField
            label="Payment screenshot"
            name="screenshot"
            hint="Required. The verifier checks it against the entry. PNG, JPG or WebP up to 10 MB."
            required
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton pendingText="Uploading…">{fix ? "Submit the correction" : "Submit for verification"}</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
