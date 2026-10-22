"use client";

import { useState } from "react";
import { copyToClipboard } from "./clipboard";
import { Button } from "./ui";

// Copy button. After a click it turns green with a ✓ (success colour) or orange if copying was refused.
const STATE_STYLE = {
  idle: "",
  copied: "!border !border-green/50 !bg-green/15 !text-green",
  failed: "!border !border-orange/50 !bg-orange/10 !text-orange",
};

export function CopyCode({ code, label = "Copy code", variant = "gold" }: { code: string; label?: string; variant?: "gold" | "ghost" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      type="button"
      variant={variant}
      className={STATE_STYLE[state]}
      onClick={async () => {
        setState((await copyToClipboard(code)) ? "copied" : "failed");
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "copied" ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : state === "failed" ? (
        "Press Ctrl+C to copy"
      ) : (
        label
      )}
    </Button>
  );
}
