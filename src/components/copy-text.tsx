"use client";

import { useState } from "react";
import { copyToClipboard } from "./clipboard";

/** Text you click to copy (e.g. an OG code), with a copy icon and a short "Copied" confirmation. */
export function CopyText({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copied = state === "copied";
  return (
    <button
      type="button"
      onClick={async () => {
        setState((await copyToClipboard(text)) ? "copied" : "failed");
        setTimeout(() => setState("idle"), 2500);
      }}
      aria-label={copied ? `${label} copied` : `Copy ${label} ${text}`}
      title="Click to copy"
      className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent p-0 font-bold ${className}`}
    >
      <span className="group-hover:underline">{text}</span>
      {copied ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-green" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Copied
        </span>
      ) : state === "failed" ? (
        <span className="text-xs font-semibold text-orange">Couldn&apos;t copy: select it and press Ctrl+C</span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-70">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
