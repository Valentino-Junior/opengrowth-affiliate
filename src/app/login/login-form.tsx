"use client";

import Link from "next/link";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui";
import { Field } from "@/components/field";
import { Flash, useFlashActionState } from "@/components/flash";

export function LoginForm() {
  const [state, action, pending] = useFlashActionState<LoginState>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <div className="flex flex-col gap-1.5">
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Link href="/forgot-password" className="self-end text-sm text-muted hover:text-ink">
          Forgot password?
        </Link>
      </div>
      {state.error ? (
        <Flash nonce={state.nonce} tone="error">
          {state.error}
        </Flash>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
