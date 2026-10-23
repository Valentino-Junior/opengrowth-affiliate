import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { methodLabel } from "@/lib/labels";
import { Card, Pill } from "@/components/ui";
import { EmptyRow, Table, Td, Th } from "@/components/table";
import { IdStatusPill } from "@/components/id-status";

const statusTone = {
  pending_approval: "gold",
  active: "green",
  inactive: "grey",
  flagged: "orange",
  disqualified: "red",
} as const;

export default async function AffiliatesPage() {
  await requireRole(AREA_ROLES.ops);
  const affiliates = await db.affiliate.findMany({
    where: { status: { not: "pending_approval" } },
    orderBy: { referralCode: "asc" },
    include: { user: true, _count: { select: { players: { where: { linkStatus: "confirmed" } } } } },
  });

  return (
    <Card className="!px-0 !pt-2">
      <Table>
        <thead>
          <tr>
            <Th>Affiliate</Th>
            <Th>Code</Th>
            <Th>Players</Th>
            <Th>Payout</Th>
            <Th>ID</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {affiliates.length === 0 ? <EmptyRow cols={6}>No affiliates yet.</EmptyRow> : null}
          {affiliates.map((a) => (
            <tr key={a.id}>
              <Td className="font-semibold">{a.legalName}</Td>
              <Td className="text-gold">{a.referralCode ?? "—"}</Td>
              <Td>{a._count.players}</Td>
              <Td>{methodLabel(a.payoutMethod)}</Td>
              <Td>
                <IdStatusPill status={a.idStatus} audience="ops" />
              </Td>
              <Td>
                <Pill tone={statusTone[a.status]}>{a.status.replace("_", " ")}</Pill>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
