import Link from "next/link";
import { changePasswordAction, updateNameAction, updatePayoutAction } from "@/app/actions/account";
import { requireRole } from "@/lib/auth";
import { ROLE_LABEL, methodLabel } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { CopyCode } from "@/components/copy-code";
import { PayoutFields } from "@/components/payout-fields";
import { Avatar, displayName } from "@/components/avatar";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageTitle, Pill } from "@/components/ui";
import { IdStatusPill } from "@/components/id-status";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/money";
import { appOrigin } from "@/lib/origin";

export const metadata = { title: "My profile · Opengrowth" };

const STATUS = {
  pending_approval: { label: "Waiting for approval", tone: "gold" },
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "grey" },
  flagged: { label: "Under review", tone: "orange" },
  disqualified: { label: "Disqualified", tone: "red" },
} as const;

const memberSince = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });

export default async function AccountPage() {
  const user = await requireRole(["affiliate", "employee", "ops", "admin"]);
  const a = user.affiliate;
  const settings = await getSettings();
  const referralLink = a?.referralCode ? `${await appOrigin()}/r/${a.referralCode}` : null;
  const name = displayName(user);
  const nameLocked = !!a && (a.idStatus === "verified" || a.idStatus === "submitted");

  return (
    <>
      <PageTitle eyebrow={ROLE_LABEL[user.role].toUpperCase()} title="My profile" lead="Your details as the team sees them, and the settings you can change yourself." />

      <Card aria-label="Profile" className="flex flex-wrap items-center gap-6">
        <Avatar name={name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-2xl font-extrabold">{name}</h2>
            <Pill tone="gold">{ROLE_LABEL[user.role]}</Pill>
            {a ? <Pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Pill> : null}
            {a ? <IdStatusPill status={a.idStatus} /> : null}
            {a && (a.idStatus === "none" || a.idStatus === "rejected") ? (
              <Link href="/dashboard/verify" className="text-xs font-bold text-gold">
                Upload your ID (needed for payouts over {formatCents(settings.idThresholdCents, { whole: true })} and prizes)
              </Link>
            ) : null}
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted">Email</dt>
            <dd className="m-0 flex flex-wrap items-center gap-2">
              <span className="break-all">{user.email}</span>
              {user.emailVerifiedAt ? (
                <Pill tone="green">Confirmed</Pill>
              ) : (
                <Link href="/verify-email" className="text-xs font-bold text-gold">
                  Not confirmed · Confirm now
                </Link>
              )}
            </dd>
            <dt className="text-muted">Phone</dt>
            <dd className="m-0">{user.phone}</dd>
            {a ? (
              <>
                <dt className="text-muted">Paid by</dt>
                <dd className="m-0">
                  {methodLabel(a.payoutMethod)}
                  {a.payoutHandle ? ` · ${a.payoutHandle}` : ""}
                </dd>
              </>
            ) : null}
            {user.staff ? (
              <>
                <dt className="text-muted">Team</dt>
                <dd className="m-0">
                  {user.staff.team} · {user.staff.displayCode}
                </dd>
              </>
            ) : null}
            <dt className="text-muted">Member since</dt>
            <dd className="m-0">{memberSince(user.createdAt)}</dd>
          </dl>
        </div>
      </Card>

      {a?.referralCode && referralLink ? (
        <Card className="flex flex-wrap items-center justify-between gap-4" aria-label="Referral code">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[13px] font-semibold text-muted">Your referral code</span>
            <span className="font-serif text-3xl font-bold text-gold">{a.referralCode}</span>
            <span className="text-sm text-muted">
              New players give this code to our team, or sign up with your link: <span className="font-semibold break-all text-ink">{referralLink}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyCode code={a.referralCode} />
            <CopyCode code={referralLink} label="Copy link" variant="ghost" />
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-7">
          <Card aria-label="Your name" className="flex flex-col gap-4">
            <div>
              <h2 className="m-0 text-xl font-extrabold">{a ? "Your legal name" : "Your name"}</h2>
              <p className="m-0 mt-1 text-sm text-muted">
                {nameLocked
                  ? "Locked: it must match your ID for payouts and prizes. Message the team if it needs to change."
                  : a
                    ? "Must match your ID exactly, for payouts and prizes."
                    : "Shown to your teammates on the desk and in the logs."}
              </p>
            </div>
            <ActionForm action={updateNameAction} className="flex flex-col gap-4">
              <Field label={a ? "Full legal name" : "Display name"} name="name" defaultValue={name} required minLength={3} disabled={nameLocked} />
              {nameLocked ? null : (
                <div>
                  <SubmitButton pendingText="Saving…">Save name</SubmitButton>
                </div>
              )}
            </ActionForm>
          </Card>

          {a ? (
            <Card aria-label="Payout details" className="flex flex-col gap-4">
              <div>
                <h2 className="m-0 text-xl font-extrabold">Payout details</h2>
                <p className="m-0 mt-1 text-sm text-muted">Where your Monday payout is sent. Confirm with your password, because this decides where money goes.</p>
              </div>
              <ActionForm action={updatePayoutAction} className="flex flex-col gap-4">
                <PayoutFields defaultMethod={a.payoutMethod} defaultHandle={a.payoutHandle} />
                <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
                <div>
                  <SubmitButton pendingText="Saving…">Save payout details</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-7">
          <Card aria-label="Change password" className="flex flex-col gap-4">
            <div>
              <h2 className="m-0 text-xl font-extrabold">Change password</h2>
              <p className="m-0 mt-1 text-sm text-muted">At least 8 characters. Afterwards you&apos;re logged out everywhere and log in again with the new password.</p>
            </div>
            <ActionForm action={changePasswordAction} resetOnSuccess className="flex flex-col gap-4">
              <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
              <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
              <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
              <div>
                <SubmitButton pendingText="Changing…">Change password</SubmitButton>
              </div>
            </ActionForm>
          </Card>

          <Card aria-label="Email and phone" className="flex flex-col gap-2">
            <h2 className="m-0 text-xl font-extrabold">Email and phone</h2>
            <p className="m-0 text-sm text-muted">
              To change your email or phone number, message the team. Each one can belong to only one account, so the team checks the new one first.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
