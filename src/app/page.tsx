import Link from "next/link";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatCents, formatRate } from "@/lib/money";
import { Badges, Race, Rules, Steps, example, exampleSentence } from "@/components/how-it-works";
import { Brand } from "@/components/ui";

export const dynamic = "force-dynamic";

// Public landing page: what the program is, the math, the race and the rules. Every number comes from settings.

const primary = "inline-flex items-center justify-center rounded-full bg-gold px-7 py-3.5 font-bold text-bg no-underline transition hover:brightness-110";
const secondary =
  "inline-flex items-center justify-center rounded-full border border-line px-7 py-3.5 font-bold text-ink no-underline transition hover:border-muted";

export default async function HomePage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const rate = formatRate(s.commissionRateBp);
  const chat = s.groupChatUrl || "/join";
  const e = example(s);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 px-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center justify-between gap-4 py-3">
          <Brand />
          <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-semibold md:flex">
            <a href="#how-it-works" className="text-muted no-underline hover:text-ink">
              How it works
            </a>
            <a href="#race" className="text-muted no-underline hover:text-ink">
              Top 3 race
            </a>
            <a href="#rules" className="text-muted no-underline hover:text-ink">
              Rules
            </a>
          </nav>
          {user ? (
            <Link href={homeFor(user.role)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-muted">
              My account
            </Link>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="px-2 py-2 text-sm font-semibold text-ink no-underline hover:text-gold">
                Log in
              </Link>
              <Link href="/join" className="hidden rounded-full bg-gold px-4 py-2 text-sm font-bold text-bg no-underline hover:brightness-110 sm:inline-flex">
                Join
              </Link>
            </div>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pt-16 pb-12 sm:px-8 sm:pt-24">
        {/* A soft gold glow behind the headline. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(212,175,90,0.16),transparent)]"
        />
        <div className="relative mx-auto flex max-w-[880px] flex-col items-center gap-7 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-gold bg-surface-gold px-4 py-1.5 text-[11px] font-bold tracking-[3px] text-gold">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            THE NEW OPENGROWTH
          </span>
          <h1 className="m-0 font-serif text-[2.75rem] leading-[1.04] font-medium text-balance sm:text-6xl lg:text-7xl">
            Bring the players. Take {rate} of the profit.
          </h1>
          <p className="m-0 max-w-2xl text-lg text-muted text-pretty">
            Every player you bring to Young Money earns you a cut of the gross profit they generate. No credits, no ladders. Real money, paid every Monday. And
            the top 3 every month drive away with more.
          </p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/join" className={primary}>
              Become an affiliate
            </Link>
            <a href="#rules" className={secondary}>
              Read the rules
            </a>
          </div>
          <p className="m-0 text-sm text-muted">Free to join · Paid every Monday · Your players stay yours</p>
        </div>

        {/* The math, worked through with real numbers. */}
        <div
          aria-label="The math"
          role="region"
          className="relative mx-auto mt-14 max-w-[880px] rounded-[20px] border border-line-gold bg-surface-gold/80 p-6 shadow-[0_30px_80px_-40px_rgba(212,175,90,0.35)] sm:p-8"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-[3px] text-gold">THE MATH · ONE WEEK</span>
            <span className="text-xs text-muted">One formula. No fine print.</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <Figure label="Players' deposits" value={formatCents(e.deposits, { whole: true })} />
            <Op>−</Op>
            <Figure label="Their cashouts" value={formatCents(e.cashouts, { whole: true })} />
            <Op>=</Op>
            <Figure label="Gross profit" value={formatCents(e.gross, { whole: true })} className="col-span-2 sm:col-span-1" />
          </div>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-card border border-gold/40 bg-bg/60 px-5 py-4 text-center sm:flex-row sm:text-left">
            <span className="text-sm text-muted">
              × {rate} commission, sent to you on Monday
            </span>
            <span className="font-serif text-4xl text-gold">{formatCents(e.cut, { whole: e.cut % 100 === 0 })}</span>
          </div>
          <p className="m-0 mt-4 text-center text-sm text-muted">{exampleSentence(s)}</p>
        </div>
      </section>

      <section aria-label="Key numbers" className="border-y border-line-soft bg-surface/40 px-4 sm:px-8">
        <dl className="mx-auto grid max-w-[1200px] grid-cols-2 md:grid-cols-4">
          {[
            [rate, "of your players' gross profit"],
            ["Monday", "payouts, every week"],
            [formatCents(s.minPayoutCents, { whole: true }), "minimum, the rest rolls over"],
            ["3 prizes", "for the month's top affiliates"],
          ].map(([value, label], i) => (
            <div key={label} className={`flex flex-col items-center gap-1 px-3 py-7 text-center ${i % 2 ? "border-l border-line-soft" : ""} ${i === 2 ? "md:border-l" : ""} ${i >= 2 ? "border-t border-line-soft md:border-t-0" : ""}`}>
              <dt className="order-2 text-xs text-muted sm:text-sm">{label}</dt>
              <dd className="order-1 m-0 font-serif text-3xl text-gold sm:text-4xl">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-24 px-4 py-20 sm:px-8 sm:gap-28">
        <Steps settings={s} center />
        <Race settings={s} center />
        <Rules settings={s} center />
        <Badges settings={s} center />

        <section
          id="join"
          aria-label="Join"
          className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[22px] border border-line-gold bg-surface-gold px-6 py-14 text-center sm:px-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(212,175,90,0.14),transparent)]"
          />
          <span className="relative text-xs font-bold tracking-[3px] text-gold">BUILT DIFFERENT</span>
          <h2 className="relative m-0 font-serif text-4xl font-medium sm:text-5xl">Ready to build?</h2>
          <p className="relative m-0 max-w-xl text-muted">Create your account now, or message your Young Money rep in the group chat.</p>
          <div className="relative flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/join" className={primary}>
              Become an affiliate
            </Link>
            <a href={chat} className={secondary} {...(s.groupChatUrl ? { target: "_blank", rel: "noreferrer" } : {})}>
              Message the team
            </a>
          </div>
        </section>
      </main>
    </>
  );
}

function Figure({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-card border border-line bg-bg/50 px-3 py-4 text-center ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-extrabold sm:text-3xl">{value}</span>
    </div>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="hidden text-center text-2xl font-bold text-muted sm:block">
      {children}
    </span>
  );
}
