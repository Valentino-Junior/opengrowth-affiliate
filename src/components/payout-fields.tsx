"use client";

import { useState } from "react";
import type { PaymentMethod } from "@prisma/client";
import { PAYMENT_METHODS } from "@/lib/labels";
import { Field } from "./field";
import { Select } from "./select";

// "Get paid by" + "Payout handle". The handle is your username or address on that payment app, i.e. where
// the Monday commission is sent; the hint changes with the app so people know exactly what to type.

const HANDLE_HELP: Record<PaymentMethod, { hint: string; placeholder: string }> = {
  cash_app: { hint: "Your Cash App $cashtag, like $jordan23.", placeholder: "$cashtag" },
  venmo: { hint: "Your Venmo username, like @jordan-23.", placeholder: "@username" },
  paypal: { hint: "The email address on your PayPal account.", placeholder: "you@email.com" },
  chime: { hint: "Your Chime $ChimeSign, like $jordan-chime.", placeholder: "$ChimeSign" },
  apple_pay: { hint: "The phone number or email on your Apple Pay account.", placeholder: "Phone or email" },
  google_pay: { hint: "The phone number or email on your Google Pay account.", placeholder: "Phone or email" },
  crypto: { hint: "Your wallet address. Double-check it: crypto payments can't be reversed.", placeholder: "Wallet address" },
};

export function PayoutFields({ defaultMethod, defaultHandle }: { defaultMethod?: PaymentMethod | null; defaultHandle?: string | null }) {
  const [method, setMethod] = useState<PaymentMethod | "">(defaultMethod ?? "");
  const help = method ? HANDLE_HELP[method] : { hint: "Where your commission is sent. Pick how you get paid first.", placeholder: "" };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label="Get paid by"
        name="payoutMethod"
        options={PAYMENT_METHODS}
        placeholder="Choose…"
        required
        defaultValue={defaultMethod ?? ""}
        onChange={(e) => setMethod(e.currentTarget.value as PaymentMethod)}
      />
      <Field label="Payout handle" name="payoutHandle" defaultValue={defaultHandle ?? ""} placeholder={help.placeholder} hint={help.hint} required />
    </div>
  );
}
