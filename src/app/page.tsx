import Link from "next/link";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatRate } from "@/lib/money";
import { HowItWorksSections } from "@/components/how-it-works";
import { Brand } from "@/components/ui";

export const dynamic = "force-dynamic";

// Public, player- and affiliate-facing explainer (from the original how-it-works design). Every number comes from settings.

export default async function HowItWorksPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const rate = formatRate(s.commissionRateBp);
  const chat = s.groupChatUrl || "/join";

  return (
    <>
      <header className="border-b border-line px-4 sm:px-8">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] items-center justify-between gap-4 py-3">
          <Brand />
          {user ? (
            <Link
              href={homeFor(user.role)}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-muted"
            >
              My account
            </Link>
          ) : (
            <Link href="/login" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-muted">
              Affiliate login
            </Link>
          )}
        </div>
      </header>

      <section className="border-b border-line-soft px-4 pt-16 pb-14 sm:px-8 sm:pt-20">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <span className="text-xs font-bold tracking-[3px] text-gold">THE NEW OPENGROWTH</span>
          <h1 className="m-0 max-w-4xl font-serif text-5xl leading-[1.02] font-medium sm:text-7xl">Bring the players. Take {rate} of the profit.</h1>
          <p className="m-0 max-w-2xl text-lg text-muted">
            Every player you bring to Young Money earns you a cut of the gross profit they generate. No credits, no ladders. Real money, paid every Monday. And
            the top 3 every month drive away with more.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/join" className="rounded-full bg-gold px-6 py-3 font-bold text-bg no-underline">
              Become an affiliate
            </Link>
            <a href="#rules" className="rounded-full border border-line px-6 py-3 font-bold text-ink no-underline">
              Read the rules
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-20 px-4 py-16 sm:px-8">
        <HowItWorksSections settings={s} />

        <section
          id="join"
          aria-label="Join"
          className="flex flex-col items-center gap-5 rounded-[18px] border border-line-gold bg-surface-gold px-6 py-12 text-center sm:px-10"
        >
          <span className="text-xs font-bold tracking-[3px] text-gold">BUILT DIFFERENT</span>
          <h2 className="m-0 font-serif text-4xl font-medium sm:text-5xl">Ready to build?</h2>
          <p className="m-0 max-w-xl text-muted">Create your account now, or message your Young Money rep in the group chat.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/join" className="rounded-full bg-gold px-6 py-3 font-bold text-bg no-underline">
              Become an affiliate
            </Link>
            <a
              href={chat}
              className="rounded-full border border-line px-6 py-3 font-bold text-ink no-underline"
              {...(s.groupChatUrl ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              Message the team
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
