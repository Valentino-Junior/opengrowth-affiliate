import Link from "next/link";
import { submitIdAction } from "@/app/actions/verification";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle } from "@/components/ui";

const fileInput =
  "rounded-[10px] border border-dashed border-line bg-bg px-3.5 py-3 text-sm font-normal text-muted file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-surface file:px-4 file:py-1.5 file:font-bold file:text-ink";

export default async function VerifyIdPage() {
  const user = await requireRole(AREA_ROLES.affiliate);
  const affiliate = user.affiliate!;
  const settings = await getSettings();
  const lastRejected =
    affiliate.idStatus === "rejected"
      ? await db.idDocument.findFirst({ where: { affiliateId: affiliate.id, status: "rejected" }, orderBy: { createdAt: "desc" } })
      : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/dashboard" className="text-sm text-muted">
          ← Back to dashboard
        </Link>
        <PageTitle
          eyebrow="ACCOUNT VERIFICATION"
          title="Verify my ID"
          lead={`Needed before any payout over ${formatCents(settings.idThresholdCents, { whole: true })} and before any Top 3 prize. The name on your ID must match your account: ${affiliate.legalName}.`}
        />
      </div>

      {affiliate.idStatus === "verified" ? (
        <Card tone="green">
          <p className="m-0">Your ID is verified. Nothing else to do.</p>
        </Card>
      ) : affiliate.idStatus === "submitted" ? (
        <Card>
          <p className="m-0">Your ID is with the team for review. You&apos;ll see the result on your dashboard.</p>
        </Card>
      ) : (
        <>
          {lastRejected ? (
            <Card tone="gold">
              <p className="m-0 text-sm">
                Your last upload was rejected: <strong>{lastRejected.rejectReason}</strong>. Please upload again.
              </p>
            </Card>
          ) : null}
          <Card>
            <ActionForm action={submitIdAction} className="flex flex-col gap-5">
              <Field label="Your name exactly as it appears on the ID" name="nameOnId" defaultValue={affiliate.legalName} required />
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-soft">
                Photo of the front of your ID
                <input type="file" name="front" accept="image/png,image/jpeg,image/webp" required className={fileInput} />
                <span className="text-xs font-normal text-muted">Driver&apos;s license, state ID or passport. All four corners in the photo.</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-soft">
                Selfie holding the ID
                <input type="file" name="selfie" accept="image/png,image/jpeg,image/webp" required className={fileInput} />
                <span className="text-xs font-normal text-muted">Your face and the ID both clearly visible.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-[#d4af5a]" />
                This is my own ID. I understand the team will check it against my account and keep it private.
              </label>
              <div>
                <SubmitButton pendingText="Uploading…">Send for review</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </>
      )}
    </>
  );
}
