import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Brand } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password · Opengrowth" };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-4 py-16">
      <div className="flex justify-center">
        <Brand />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="m-0 font-serif text-4xl font-medium">Forgot password</h1>
        <p className="m-0 text-muted">We&apos;ll email you a code to set a new one.</p>
      </div>
      <ForgotForm />
      <div className="flex justify-center text-sm">
        <Link href="/login" className="text-muted">
          ← Back to log in
        </Link>
      </div>
    </main>
  );
}
