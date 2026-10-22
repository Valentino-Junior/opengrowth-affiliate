import Link from "next/link";
import { redirect } from "next/navigation";
import { confirmEmailAction, resendEmailCodeAction } from "@/app/actions/account";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Brand } from "@/components/ui";

export const metadata = { title: "Confirm your email · Opengrowth" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect(homeFor(user.role));
  const showDevMailbox = !emailConfigured() && process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-4 py-16">
      <div className="flex justify-center">
        <Brand />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="m-0 font-serif text-4xl font-medium">Confirm your email</h1>
        <p className="m-0 text-muted">
          We sent a 6-digit code to <strong className="break-all text-ink">{user.email}</strong>. It works for 15 minutes.
        </p>
      </div>
      {showDevMailbox ? (
        <p className="m-0 rounded-[10px] border border-line-gold bg-surface-gold px-4 py-3 text-center text-sm">
          Email isn&apos;t connected yet, so nothing was sent. Find the code in the{" "}
          <Link href="/dev/mailbox" className="font-semibold text-gold" target="_blank">
            dev mailbox
          </Link>
          .
        </p>
      ) : null}
      <ActionForm action={confirmEmailAction} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
          className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        />
        <SubmitButton pendingText="Checking…">Confirm email</SubmitButton>
      </ActionForm>
      <div className="flex flex-col items-center gap-3 text-center text-sm text-muted">
        <ActionForm action={resendEmailCodeAction} className="flex flex-col items-center gap-2">
          <span>
            Didn&apos;t get it? Check spam, or{" "}
            <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-gold hover:underline">
              send a new code
            </button>
          </span>
        </ActionForm>
        <Link href={homeFor(user.role)} className="text-muted">
          Do this later
        </Link>
      </div>
    </main>
  );
}
