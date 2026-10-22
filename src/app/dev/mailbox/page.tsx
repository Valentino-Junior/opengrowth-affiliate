import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { formatDateTime } from "@/lib/labels";
import { Brand, Card, PageTitle, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev mailbox · Opengrowth" };

// Development only: the emails the app would have sent, while no email service (RESEND_API_KEY) is connected.
export default async function DevMailboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const messages = await db.emailMessage.findMany({ orderBy: { createdAt: "desc" }, take: 30 });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-12">
      <Brand suffix="DEV" tag="DEVELOPMENT ONLY" />
      <PageTitle
        eyebrow="DEV MAILBOX"
        title="Emails the app sent"
        lead={
          emailConfigured()
            ? "An email service is connected, so real emails go out. Only subjects and delivery status are listed here."
            : "No email service is connected (RESEND_API_KEY is empty), so emails are kept here instead of being sent. Newest first."
        }
      />
      {messages.length === 0 ? <p className="m-0 text-muted">Nothing yet. Sign up as an affiliate to get a confirmation code.</p> : null}
      {messages.map((m) => (
        <Card key={m.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              To <strong>{m.to}</strong>
            </span>
            <span className="flex items-center gap-2 text-muted">
              {formatDateTime(m.createdAt)}
              <Pill tone={m.status === "failed" ? "red" : m.status === "sent" ? "green" : "grey"}>{m.status}</Pill>
            </span>
          </div>
          <h2 className="m-0 text-lg font-extrabold">{m.subject}</h2>
          {m.body ? <pre className="m-0 font-sans text-sm whitespace-pre-wrap text-ink-soft">{m.body}</pre> : null}
          {m.error ? <p className="m-0 text-sm text-red">{m.error}</p> : null}
        </Card>
      ))}
    </main>
  );
}
