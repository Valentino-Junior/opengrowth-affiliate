"use client";

import { useState } from "react";
import { copyToClipboard } from "./clipboard";
import { Button } from "./ui";

export function CopyCode({ code, label = "Copy code", variant = "gold" }: { code: string; label?: string; variant?: "gold" | "ghost" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        setState((await copyToClipboard(code)) ? "copied" : "failed");
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Press Ctrl+C to copy" : label}
    </Button>
  );
}
