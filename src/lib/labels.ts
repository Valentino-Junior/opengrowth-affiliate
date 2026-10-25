import type { FlagReason, PaymentMethod, Role } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = { affiliate: "Affiliate", employee: "Desk employee", ops: "Ops manager", admin: "Admin" };

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash_app", label: "Cash App" },
  { value: "chime", label: "Chime" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "venmo", label: "Venmo" },
  { value: "google_pay", label: "Google Pay" },
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Crypto" },
];

export const methodLabel = (m: PaymentMethod | null | undefined) =>
  PAYMENT_METHODS.find((x) => x.value === m)?.label ?? "—";

export const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  email_match: "Email matches the affiliate",
  phone_match: "Phone matches the affiliate",
  payment_handle_match: "Payment handle matches the affiliate",
  duplicate_account: "Duplicate account",
  other: "Other",
};

/** "10:50" in the business time zone. */
export function formatTime(at: Date): string {
  return at.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: process.env.APP_TIMEZONE || "America/New_York",
  });
}

/** "Oct 19, 10:50" in the business time zone. */
export function formatDateTime(at: Date): string {
  return at.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: process.env.APP_TIMEZONE || "America/New_York",
  });
}
