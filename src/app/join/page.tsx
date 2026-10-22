import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { signupAffiliateAction } from "@/app/actions/people";
import { PAYMENT_METHODS } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { SubmitButton } from "@/components/submit-button";
import { Brand } from "@/components/ui";

export const metadata = { title: "Become an affiliate · Opengrowth" };

export default async function JoinPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-8 px-4 py-16">
      <div className="flex justify-center">
        <Brand />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="m-0 font-serif text-4xl font-medium">Become an affiliate</h1>
        <p className="m-0 text-muted">
          One person, one account. Use your own email and phone. The team approves new accounts and then issues your OG code.
        </p>
      </div>
      <ActionForm action={signupAffiliateAction} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <Field label="Full legal name" name="legalName" autoComplete="name" hint="Must match your ID for payouts and prizes." required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Phone number" name="phone" type="tel" autoComplete="tel" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Get paid by" name="payoutMethod" options={PAYMENT_METHODS} placeholder="Choose…" required />
          <Field label="Payout handle" name="payoutHandle" placeholder="$yourcashtag" required />
        </div>
        <SubmitButton pendingText="Creating account…">Create my account</SubmitButton>
      </ActionForm>
      <p className="m-0 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-gold">
          Log in
        </Link>
      </p>
    </main>
  );
}
