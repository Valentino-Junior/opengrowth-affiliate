import { AREA_ROLES, requireRole } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { NewPlayers } from "../_components/new-players";

export default async function DeskNewPlayersPage() {
  await requireRole(AREA_ROLES.desk);
  return (
    <>
      <PageTitle
        eyebrow="TRANSACTION DESK"
        title="New players"
        lead="Players who signed up through an affiliate's link are tagged automatically. Confirm the link before their first deposit is logged."
      />
      <NewPlayers />
    </>
  );
}
