import { playerSignupAction } from "@/app/actions/people";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Brand } from "@/components/ui";
import { PayoutFields } from "@/components/payout-fields";

export const metadata = { title: "Join Young Money · Opengrowth" };
export const dynamic = "force-dynamic";

export default async function PlayerSignupPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = "" } = await searchParams;
  const affiliate = ref
    ? await db.affiliate.findUnique({ where: { referralCode: ref.toUpperCase() }, select: { status: true } })
    : null;
  const valid = affiliate && (affiliate.status === "active" || affiliate.status === "flagged");

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-8 px-4 py-16">
      <div className="flex justify-center">
        <Brand />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="m-0 font-serif text-4xl font-medium">Join Young Money</h1>
        <p className="m-0 text-muted">
          {valid ? (
            <>
              You were invited with code <span className="font-bold text-gold">{ref.toUpperCase()}</span>.
            </>
          ) : (
            "Enter the referral code you were given."
          )}
        </p>
      </div>
      <ActionForm action={playerSignupAction} resetOnSuccess className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        {valid ? <input type="hidden" name="referralCode" value={ref.toUpperCase()} /> : <Field label="Referral code" name="referralCode" placeholder="OG-A01" required />}
        <Field label="Player handle" name="handle" hint="The name you play under." required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Phone number" name="phone" type="tel" autoComplete="tel" required />
        <PayoutFields forPlayer emptyHint="The account you deposit from. Pick the app first." />
        <SubmitButton pendingText="Signing up…">Sign up</SubmitButton>
      </ActionForm>
    </main>
  );
}
