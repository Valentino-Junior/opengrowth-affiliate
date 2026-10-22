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

type Props = {
  defaultMethod?: PaymentMethod | null;
  defaultHandle?: string | null;
  /** Players: "Pays with" / "Payment handle" (the account they deposit from). Default: an affiliate's payout. */
  forPlayer?: boolean;
  required?: boolean;
  /** Hint shown before an app is picked. */
  emptyHint?: string;
};

export function PayoutFields({ defaultMethod, defaultHandle, forPlayer = false, required = true, emptyHint }: Props) {
  const [method, setMethod] = useState<PaymentMethod | "">(defaultMethod ?? "");
  const empty = emptyHint ?? (forPlayer ? "The account the player deposits from. Pick the app first." : "Where your commission is sent. Pick how you get paid first.");
  const help = method ? HANDLE_HELP[method] : { hint: empty, placeholder: "" };
  const names = forPlayer
    ? { method: "paymentMethod", handle: "paymentHandle", methodLabel: "Pays with", handleLabel: "Payment handle" }
    : { method: "payoutMethod", handle: "payoutHandle", methodLabel: "Get paid by", handleLabel: "Payout handle" };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label={names.methodLabel}
        name={names.method}
        options={PAYMENT_METHODS}
        placeholder={required ? "Choose…" : "Not given"}
        required={required}
        defaultValue={defaultMethod ?? ""}
        onChange={(e) => setMethod(e.currentTarget.value as PaymentMethod)}
      />
      <Field
        label={names.handleLabel}
        name={names.handle}
        defaultValue={defaultHandle ?? ""}
        placeholder={help.placeholder}
        hint={help.hint}
        required={required || method !== ""}
      />
    </div>
  );
}
