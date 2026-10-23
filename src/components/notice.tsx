"use client";

import { useState } from "react";
import { Card } from "./ui";

// A green confirmation card shown after a redirect (?done=…), e.g. "Approved Jordan: OG-A09".
// It fades out after a few seconds and drops its query from the address, so a refresh doesn't show it again.

export function Notice({ param, children }: { param: string; children: React.ReactNode }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <Card
      tone="green"
      role="status"
      className="flash-out"
      onAnimationEnd={() => {
        setGone(true);
        const url = new URL(window.location.href);
        url.searchParams.delete(param);
        window.history.replaceState(window.history.state, "", url);
      }}
    >
      {children}
    </Card>
  );
}
