import { AREA_ROLES, requireRole } from "@/lib/auth";
import { EntryDetail } from "@/components/entry-detail";

export default async function DeskEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(AREA_ROLES.desk);
  return <EntryDetail id={(await params).id} user={user} area="desk" />;
}
