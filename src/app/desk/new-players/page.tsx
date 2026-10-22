import { AREA_ROLES, requireRole } from "@/lib/auth";
import { ModalButton } from "@/components/modal-button";
import { PageTitle } from "@/components/ui";
import { AddPlayerForm, NewPlayers } from "../_components/new-players";

export default async function DeskNewPlayersPage() {
  await requireRole(AREA_ROLES.desk);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle
          eyebrow="TRANSACTION DESK"
          title="New players"
          lead="Players who signed up through an affiliate's link are tagged automatically. Confirm the link before their first deposit is logged."
        />
        <ModalButton
          label="Add player"
          title="Add a player who gave a code at the desk"
          description="The link is confirmed as you add it, unless the details match the affiliate."
        >
          <AddPlayerForm />
        </ModalButton>
      </div>
      <NewPlayers />
    </>
  );
}
