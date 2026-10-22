"use client";

import { useActionState, useState } from "react";
import { markPaidAction } from "@/app/actions/payouts";
import type { ActionState } from "@/lib/errors";
import { Button } from "@/components/ui";

/** "Mark paid" → a confirm step that restates who, how much and how, with an optional payment reference. */
export function MarkPaid({ rowId, amountCents, amount, method, name }: { rowId: string; amountCents: string; amount: string; method: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(markPaidAction, {});

  if (!open)
    return (
      <Button type="button" className="!py-1.5" onClick={() => setOpen(true)} aria-label={`Mark ${name} paid`}>
        Mark paid
      </Button>
    );

  return (
    <form action={action} className="flex min-w-64 flex-col gap-2 rounded-[10px] border border-line-gold bg-surface-gold p-3">
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="amountCents" value={amountCents} />
      <span className="text-sm">
        Sent <strong>{amount}</strong> to {name} by <strong>{method}</strong>?
      </span>
      <input
        name="paymentRef"
        placeholder="Payment reference (optional)"
        aria-label="Payment reference"
        className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-ink"
      />
      <div className="flex gap-2">
        <Button type="submit" className="!py-1.5" disabled={pending}>
          {pending ? "Saving…" : `Confirm ${amount}`}
        </Button>
        <Button type="button" variant="ghost" className="!py-1.5" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.error ? <p className="m-0 text-xs text-orange">{state.error}</p> : null}
    </form>
  );
}
