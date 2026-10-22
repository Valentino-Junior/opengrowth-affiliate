import { AREA_ROLES, requireRole } from "@/lib/auth";
import { localDay, zonedLocalToDate } from "@/lib/weeks";
import { PageTitle } from "@/components/ui";
import { VerifyQueue } from "../_components/verify-queue";

export default async function DeskQueuePage() {
  const user = await requireRole(AREA_ROLES.desk);
  const since = zonedLocalToDate(`${localDay(new Date())}T00:00`);
  return (
    <>
      <PageTitle
        eyebrow="TRANSACTION DESK"
        title="Verify queue"
        lead="Check the amount, method and reference against the screenshot and the payment app. You can't verify your own entries."
      />
      <VerifyQueue userId={user.id} since={since} />
    </>
  );
}
