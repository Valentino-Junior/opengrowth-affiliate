import { logTransactionAction } from "@/app/actions/transactions";
import { db } from "@/lib/db";
import { PAYMENT_METHODS } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import { FileField } from "@/components/file-field";

export async function LogTransaction() {
  // Suggestions for the player field: players whose link is settled (confirmed, or rejected = no affiliate).
  const players = await db.player.findMany({
    where: { linkStatus: { in: ["confirmed", "rejected"] } },
    select: { handle: true, affiliate: { select: { legalName: true } }, linkStatus: true },
    orderBy: { handle: "asc" },
    take: 2000,
  });

  return (
    <Card id="log" className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-xl font-extrabold">Log a transaction</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Enter it exactly as it shows in the payment app. It goes to the verify queue, not straight to the books.
        </p>
      </div>
      <ActionForm action={logTransactionAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <input type="radio" name="type" value={value} defaultChecked={i === 0} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Player handle" name="playerHandle" list="player-handles" autoComplete="off" required />
        <datalist id="player-handles">
          {players.map((p) => (
            <option key={p.handle} value={p.handle}>
              {p.linkStatus === "confirmed" ? p.affiliate?.legalName : "No affiliate"}
            </option>
          ))}
        </datalist>
        <Field label="Amount (USD)" name="amount" inputMode="decimal" placeholder="200.00" required />
        <Select label="Payment method" name="method" options={PAYMENT_METHODS} placeholder="Choose…" required />
        <Field label="Transaction ID / reference" name="externalRef" autoComplete="off" required />
        <Field label="When (New York time)" name="occurredAt" type="datetime-local" hint="Leave empty for right now." />
        <div className="sm:col-span-2 lg:col-span-3">
          <FileField
            label="Payment screenshot"
            name="screenshot"
            hint="Required. The verifier checks it against the entry. PNG, JPG or WebP up to 10 MB."
            required
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton pendingText="Uploading…">Submit for verification</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
