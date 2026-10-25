"use client";

import { useState } from "react";
import { copyToClipboard } from "./clipboard";

// A value you click to copy (a login email, a temporary password). It turns green with a ✓ once copied.

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      aria-label={`Copy ${label.toLowerCase()}`}
      title="Click to copy"
      onClick={async () => {
        setState((await copyToClipboard(value)) ? "copied" : "failed");
        setTimeout(() => setState("idle"), 2500);
      }}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-left font-mono font-bold hover:bg-white/5 ${
        state === "copied" ? "text-green" : state === "failed" ? "text-orange" : "text-ink"
      }`}
    >
      {value}
      {state === "copied" ? (
        <span className="inline-flex items-center gap-1 font-sans text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Copied
        </span>
      ) : state === "failed" ? (
        <span className="font-sans text-xs">Press Ctrl+C to copy</span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}
