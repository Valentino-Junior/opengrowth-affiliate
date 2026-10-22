import type { IdStatus } from "@prisma/client";
import { Pill } from "./ui";

// One wording for ID status everywhere. "affiliate" talks to the person; "ops" talks about them.

const LABELS: Record<"affiliate" | "ops", Record<IdStatus, { label: string; tone: "gold" | "grey" | "green" | "orange" }>> = {
  affiliate: {
    none: { label: "No ID uploaded yet", tone: "gold" },
    submitted: { label: "ID being checked", tone: "grey" },
    verified: { label: "ID verified", tone: "green" },
    rejected: { label: "ID rejected: upload again", tone: "orange" },
  },
  ops: {
    none: { label: "No ID uploaded yet", tone: "grey" },
    submitted: { label: "ID sent: review it", tone: "gold" },
    verified: { label: "ID verified", tone: "green" },
    rejected: { label: "ID rejected", tone: "orange" },
  },
};

export function IdStatusPill({ status, audience = "affiliate" }: { status: IdStatus; audience?: "affiliate" | "ops" }) {
  const { label, tone } = LABELS[audience][status];
  return (
    <span title="An ID check is needed before large payouts and any Top 3 prize.">
      <Pill tone={tone}>{label}</Pill>
    </span>
  );
}
