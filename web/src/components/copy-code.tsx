"use client";

import { useState } from "react";
import { Button } from "./ui";

export function CopyCode({ code, label = "Copy code", variant = "gold" }: { code: string; label?: string; variant?: "gold" | "ghost" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
