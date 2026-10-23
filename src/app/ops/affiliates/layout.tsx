import { registerAffiliateAction, tagPlayerAction } from "@/app/actions/people";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { ModalButton } from "@/components/modal-button";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { PageTitle } from "@/components/ui";
import { SubTabs } from "@/components/sub-tabs";
import { PayoutFields } from "@/components/payout-fields";

export const dynamic = "force-dynamic";

/** Affiliates: everyone on one tab, signups waiting for approval on another. */
export default async function AffiliatesLayout({ children }: { children: React.ReactNode }) {
  await requireRole(AREA_ROLES.ops);
  const [count, pending] = await Promise.all([
    db.affiliate.count({ where: { status: { not: "pending_approval" } } }),
    db.affiliate.count({ where: { status: "pending_approval" } }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle eyebrow="OPS" title="Affiliates and players" lead={`${count} affiliates · ${pending} waiting for approval`} />
        <div className="flex flex-wrap gap-3">
          <ModalButton
            label="Register affiliate"
            title="Register a new affiliate"
            description="One person, one account. Email and phone are checked against every existing affiliate and player."
          >
            <ActionForm action={registerAffiliateAction} resetOnSuccess className="flex flex-col gap-4">
              <Field label="Full legal name" name="legalName" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" name="email" type="email" required />
                <Field label="Phone number" name="phone" type="tel" required />
              </div>
              <PayoutFields required={false} emptyHint="Optional. Where their commission is sent." />
              <div>
                <SubmitButton pendingText="Checking…">Check and create code</SubmitButton>
              </div>
            </ActionForm>
          </ModalButton>
          <ModalButton label="Tag player" title="Tag a new player" description="Do this when the player signs up. Commission starts from their first deposit.">
            <ActionForm action={tagPlayerAction} resetOnSuccess className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Player handle" name="handle" required />
                <Field label="Referral code" name="referralCode" placeholder="OG-A01" required />
                <Field label="Email" name="email" type="email" />
                <Field label="Phone" name="phone" type="tel" />
              </div>
              <PayoutFields forPlayer required={false} emptyHint="Optional. The account the player deposits from." />
              <div>
                <SubmitButton pendingText="Linking…">Link player</SubmitButton>
              </div>
            </ActionForm>
          </ModalButton>
        </div>
      </div>
      <SubTabs
        label="Affiliates"
        tabs={[
          { href: "/ops/affiliates", label: "All affiliates" },
          { href: "/ops/affiliates/approvals", label: "Waiting for approval", count: pending },
        ]}
      />
      {children}
    </>
  );
}
