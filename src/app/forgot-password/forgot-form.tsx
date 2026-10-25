"use client";

import { startTransition } from "react";
import { requestPasswordCodeAction, resetPasswordAction, type ForgotState } from "@/app/actions/auth";
import { Button } from "@/components/ui";
import { Field } from "@/components/field";
import { Flash, useFlashActionState } from "@/components/flash";

// Two steps on one page: email → code + new password. "Send a new code" goes back to step 1 with the email filled in.

export function ForgotForm() {
  const [sent, request, requesting] = useFlashActionState<ForgotState>(requestPasswordCodeAction, {});
  const [reset, submit, resetting] = useFlashActionState<ForgotState>(resetPasswordAction, {});
  const email = reset.sentTo ?? sent.sentTo;

  if (!email)
    return (
      <form action={request} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <Field label="Email" name="email" type="email" autoComplete="email" required hint="The email you log in with. We'll send it a 6-digit code." />
        {sent.error ? (
          <Flash nonce={sent.nonce} tone="error">
            {sent.error}
          </Flash>
        ) : null}
        <Button type="submit" disabled={requesting}>
          {requesting ? "Sending…" : "Send code"}
        </Button>
      </form>
    );

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="m-0 rounded-[10px] border border-line-green bg-surface-green px-4 py-3 text-sm text-green">
        If <strong>{email}</strong> has an account, we&apos;ve emailed it a 6-digit code. It works for 15 minutes.
      </p>
      {/* Submitted by hand, not through `action`, so a wrong code doesn't clear the passwords already typed. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => submit(data));
        }}
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6"
      >
        <input type="hidden" name="email" value={email} />
        <Field label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
        <Field label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
        <Field label="New password again" name="confirmPassword" type="password" autoComplete="new-password" required />
        {reset.error ? (
          <Flash nonce={reset.nonce} tone="error">
            {reset.error}
          </Flash>
        ) : null}
        <Button type="submit" disabled={resetting}>
          {resetting ? "Saving…" : "Set new password"}
        </Button>
      </form>
      <form action={request} className="flex justify-center">
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={requesting} className="cursor-pointer bg-transparent text-sm font-semibold text-gold disabled:opacity-50">
          {requesting ? "Sending…" : "Send a new code"}
        </button>
      </form>
    </div>
  );
}
