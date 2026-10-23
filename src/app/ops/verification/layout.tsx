import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { localDay } from "@/lib/weeks";
import { standings } from "@/lib/race";
import { PageTitle } from "@/components/ui";
import { SubTabs } from "@/components/sub-tabs";

export const dynamic = "force-dynamic";

/** Verification: one tab per kind of check, each with a count of what's waiting on it. */
export default async function VerificationLayout({ children }: { children: React.ReactNode }) {
  await requireRole(AREA_ROLES.ops);
  const month = `${localDay(new Date()).slice(0, 7)}-01`;
  const [ids, top, held, flags, prizes] = await Promise.all([
    db.idDocument.count({ where: { status: "submitted" } }),
    standings(month).then((t) => t.slice(0, 3)),
    db.affiliateWeek.findMany({ where: { status: "needs_id" }, select: { affiliateId: true } }),
    db.flag.findMany({ where: { status: "open" }, select: { id: true, playerId: true } }),
    db.raceResult.count({ where: { rank: { lte: 3 }, prizeStatus: { not: "released" }, affiliate: { idStatus: "verified", status: { not: "flagged" } } } }),
  ]);
  const needsId = new Set([...top.filter((t) => !t.idVerified).map((t) => t.affiliateId), ...held.map((h) => h.affiliateId)]).size;
  const flagReviews = new Set(flags.map((f) => f.playerId ?? f.id)).size;

  return (
    <>
      <PageTitle eyebrow="OPS" title="Verification" lead="A flagged affiliate can't be paid or win a prize until the flag is cleared." />
      <SubTabs
        label="Verification"
        tabs={[
          { href: "/ops/verification", label: "IDs to review", count: ids },
          { href: "/ops/verification/needs-id", label: "Who needs an ID", count: needsId },
          { href: "/ops/verification/flags", label: "Flags", count: flagReviews },
          { href: "/ops/verification/prizes", label: "Prizes", count: prizes },
        ]}
      />
      {children}
    </>
  );
}
