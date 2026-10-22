import Link from "next/link";
import { Card } from "./ui";

/** Top-of-page note about email confirmation: a reminder while unconfirmed, a thank-you right after confirming. */
export function EmailNotice({ email, verified, justConfirmed }: { email: string; verified: boolean; justConfirmed: boolean }) {
  if (verified && justConfirmed)
    return (
      <Card tone="green">
        <p className="m-0 text-sm">Email confirmed. Thanks!</p>
      </Card>
    );
  if (verified) return null;
  return (
    <Card tone="gold" className="flex flex-wrap items-center justify-between gap-3">
      <p className="m-0 text-sm">
        Confirm your email: we sent a 6-digit code to <strong className="break-all">{email}</strong>.
      </p>
      <Link href="/verify-email" className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-bg no-underline">
        Enter code
      </Link>
    </Card>
  );
}
