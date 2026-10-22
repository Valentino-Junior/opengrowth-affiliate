import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { monthLabel, prizeNames, standings } from "@/lib/race";
import { localDay } from "@/lib/weeks";
import { getSettings } from "@/lib/settings";
import { Card, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { IdStatusPill } from "@/components/id-status";

const PLACES = ["1st", "2nd", "3rd"];

/** Who needs an ID check before money or a prize goes out: this month's top 3 + any payout held for ID. */
export async function IdChecks() {
  const month = `${localDay(new Date()).slice(0, 7)}-01`;
  const [top, prizes, held, settings] = await Promise.all([
    standings(month).then((t) => t.slice(0, 3)),
    prizeNames(),
    db.affiliateWeek.findMany({ where: { status: "needs_id" }, include: { affiliate: true } }),
    getSettings(),
  ]);
  const thresholdCents = BigInt(settings.idThresholdCents);
  const ids = [...top.map((t) => t.affiliateId), ...held.map((h) => h.affiliateId)];
  const affiliates = await db.affiliate.findMany({ where: { id: { in: ids } } });
  const byId = new Map(affiliates.map((a) => [a.id, a]));

  const rows = [
    ...top.map((t, i) => ({ key: `race-${t.affiliateId}`, affiliateId: t.affiliateId, reason: `${monthLabel(month).split(" ")[0]} ${PLACES[i]} place: ${prizes[i].replace(/^an? /i, "")}` })),
    ...held.map((h) => ({ key: `pay-${h.id}`, affiliateId: h.affiliateId, reason: `Payout of ${formatCents(h.payableCents)} (over ${formatCents(thresholdCents, { whole: true })})` })),
  ];

  return (
    <Card id="needs-id" aria-label="Who still needs an ID" className="flex flex-col gap-3 !px-0">
      <div className="px-6">
        <h2 className="m-0 text-xl font-extrabold">Who still needs an ID</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Required for any payout over {formatCents(thresholdCents, { whole: true })} and every Top 3 prize. Name on ID must match the account. A flagged affiliate can&apos;t receive a prize until the flag is cleared; if
          they&apos;re disqualified, the next affiliate in line moves up.
        </p>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Affiliate</Th>
            <Th>Reason</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>ID</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow cols={6}>Nobody needs an ID check right now.</EmptyRow> : null}
          {rows.map((r) => {
            const a = byId.get(r.affiliateId)!;
            return (
              <tr key={r.key}>
                <Td className="font-semibold whitespace-nowrap">{a.legalName}</Td>
                <Td>{r.reason}</Td>
                {/* Email and phone are unique by construction (contact registry), so these always read Unique. */}
                <Td>
                  <Pill tone="green">Unique</Pill>
                </Td>
                <Td>
                  <Pill tone="green">Unique</Pill>
                </Td>
                <Td>
                  {a.status === "flagged" ? (
                    <Pill tone="red">On hold: flagged</Pill>
                  ) : (
                    <IdStatusPill status={a.idStatus} audience="ops" />
                  )}
                </Td>
                <Td>
                  {a.idStatus === "submitted" ? (
                    <Link href="/ops/verification#ids" className="rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-bg no-underline">
                      Verify ID
                    </Link>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
