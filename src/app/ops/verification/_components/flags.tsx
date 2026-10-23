import { resolveFlagAction } from "@/app/actions/people";
import { db } from "@/lib/db";
import { FLAG_REASON_LABEL, formatDateTime } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";

/** Open self-referral flags (one row per player) with Clear / Disqualify, and the recently resolved ones. */
export async function Flags() {
  const [open, recent] = await Promise.all([
    db.flag.findMany({ where: { status: "open" }, orderBy: { createdAt: "asc" }, include: { affiliate: true, player: true } }),
    db.flag.findMany({
      where: { status: { not: "open" } },
      orderBy: { resolvedAt: "desc" },
      take: 10,
      include: { affiliate: true, player: true },
    }),
  ]);

  // One review per player: email + phone matches on the same player show as one row.
  const groups = new Map<string, typeof open>();
  for (const f of open) {
    const key = f.playerId ?? f.id;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  return (
    <>
      <Card tone={groups.size ? "gold" : "default"} className="!px-0">
        <div className="mb-3 px-6">
          <h2 className="m-0 text-xl font-extrabold">Open flags</h2>
          <p className="m-0 mt-1 text-sm text-muted">
            Clear = not a self-referral, the player&apos;s link is confirmed. Disqualify = the link is cancelled and the affiliate never earns on this player.
          </p>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Affiliate</Th>
              <Th>Player</Th>
              <Th>What matched</Th>
              <Th>Raised</Th>
              <Th>Decision</Th>
            </tr>
          </thead>
          <tbody>
            {groups.size === 0 ? <EmptyRow cols={5}>No open flags.</EmptyRow> : null}
            {[...groups.values()].map((flags) => {
              const f = flags[0];
              return (
                <tr key={f.id}>
                  <Td className="font-semibold">
                    {f.affiliate.legalName} <span className="text-gold">{f.affiliate.referralCode}</span>
                  </Td>
                  <Td>{f.player?.handle ?? "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {flags.map((x) => (
                        <Pill key={x.id} tone="orange">
                          {FLAG_REASON_LABEL[x.reason]}
                        </Pill>
                      ))}
                    </div>
                    {f.detail ? <span className="mt-1 block text-xs text-muted">{f.detail}</span> : null}
                  </Td>
                  <Td>{formatDateTime(f.createdAt)}</Td>
                  <Td>
                    <ActionForm action={resolveFlagAction} hidden={{ flagId: f.id }} className="flex flex-wrap items-center gap-2">
                      <input
                        name="note"
                        placeholder="Note (optional)"
                        aria-label="Note"
                        className="w-40 rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-ink"
                      />
                      <SubmitButton name="decision" value="clear" className="!py-1.5">
                        Clear
                      </SubmitButton>
                      <SubmitButton name="decision" value="disqualify" variant="danger" className="!py-1.5">
                        Disqualify
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="!px-0">
        <h2 className="m-0 mb-3 px-6 text-xl font-extrabold">Recently resolved</h2>
        <Table>
          <thead>
            <tr>
              <Th>Affiliate</Th>
              <Th>Player</Th>
              <Th>Reason</Th>
              <Th>Outcome</Th>
              <Th>Resolved</Th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? <EmptyRow cols={5}>Nothing resolved yet.</EmptyRow> : null}
            {recent.map((f) => (
              <tr key={f.id}>
                <Td>{f.affiliate.legalName}</Td>
                <Td>{f.player?.handle ?? "—"}</Td>
                <Td>{FLAG_REASON_LABEL[f.reason]}</Td>
                <Td>{f.status === "cleared" ? <Pill tone="green">Cleared</Pill> : <Pill tone="red">Disqualified</Pill>}</Td>
                <Td>{f.resolvedAt ? formatDateTime(f.resolvedAt) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

    </>
  );
}
