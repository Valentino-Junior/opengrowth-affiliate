import { AREA_ROLES, requireRole } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { LogTransaction } from "../_components/log-transaction";
import { MyRejected } from "../_components/verify-queue";

export default async function DeskLogPage() {
  const user = await requireRole(AREA_ROLES.desk);
  return (
    <>
      <PageTitle
        eyebrow="TRANSACTION DESK"
        title="Log a transaction"
        lead="Enter it exactly as it shows in the payment app. It goes to the verify queue, not straight to the books."
      />
      <MyRejected userId={user.id} />
      <LogTransaction />
    </>
  );
}
