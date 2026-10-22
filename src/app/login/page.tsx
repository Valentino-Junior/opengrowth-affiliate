import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Brand } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · Opengrowth" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-4 py-16">
      <Brand />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-serif text-4xl font-medium">Log in</h1>
        <p className="m-0 text-muted">Affiliates, desk staff and ops all log in here.</p>
      </div>
      <LoginForm />
    </main>
  );
}
