import type { TxType } from "@prisma/client";

// Deposit / Cashout as coloured text with an arrow: green ↓ money in, orange ↑ money out — the same colours
// the gross profit figure uses (a deposit adds to it, a cashout takes away). Plain text, not a badge, so it
// isn't mistaken for a status.

export function TxTypeLabel({ type }: { type: TxType }) {
  const deposit = type === "deposit";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap ${deposit ? "text-green" : "text-orange"}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {deposit ? <path d="M12 5v14M5 12l7 7 7-7" /> : <path d="M12 19V5M5 12l7-7 7 7" />}
      </svg>
      {deposit ? "Deposit" : "Cashout"}
    </span>
  );
}
