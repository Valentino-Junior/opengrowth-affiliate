import Link from "next/link";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatCents, formatRate } from "@/lib/money";
import { Brand } from "@/components/ui";

export const dynamic = "force-dynamic";

// Public, player- and affiliate-facing explainer (from the original how-it-works design). Every number comes from settings.

function SectionTitle({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {eyebrow ? <span className="text-xs font-bold tracking-[3px] text-gold">{eyebrow}</span> : null}
      <h2 className="m-0 font-serif text-4xl leading-[1.05] font-medium sm:text-5xl">{title}</h2>
      {lead ? <p className="m-0 text-base text-muted">{lead}</p> : null}
    </div>
  );
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-6">
      <h3 className="m-0 text-lg font-extrabold">{title}</h3>
      <p className="m-0 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export default async function HowItWorksPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const rate = formatRate(s.commissionRateBp);
  const min = formatCents(s.minPayoutCents, { whole: true });
  const idOver = formatCents(s.idThresholdCents, { whole: true });
  const example = { deposits: 745_000, cashouts: 445_000 };
  const exampleGross = example.deposits - example.cashouts;
  const exampleCut = Math.floor((exampleGross * s.commissionRateBp) / 10_000);
  const badges = s.badgeThresholds;
  const places = ["1st", "2nd", "3rd"];
  const prizes = [s.prizes.first, s.prizes.second, s.prizes.third];
  const chat = s.groupChatUrl || "/join";

  return (
    <>
      <header className="border-b border-line px-4 sm:px-8">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] items-center justify-between gap-4 py-3">
          <Brand />
          {user ? (
            <Link href={homeFor(user.role)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-muted">
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
            Every player you bring to Young Money earns you a cut of the gross profit they generate. No credits, no ladders. Real money, paid every Monday. And the
            top 3 every month drive away with more.
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
        <section aria-label="Three steps" className="flex flex-col gap-7">
          <SectionTitle title="Three steps. That's it." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["01", "Get your code", "Sign up here or message our team. Once you're approved you get a personal OG code and link."],
              ["02", "Bring players in", "New players sign up with your link or give your code when they join. They're linked to you for as long as you stay active."],
              ["03", "Get paid Monday", `Every Monday we total your players' week and send you ${rate} of the gross profit.`],
            ].map(([n, title, body]) => (
              <div key={n} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
                <span className="font-serif text-4xl text-gold">{n}</span>
                <h3 className="m-0 text-xl font-extrabold">{title}</h3>
                <p className="m-0 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="The math" className="flex flex-col gap-6 rounded-[18px] border border-line-gold bg-surface-gold p-6 sm:p-10">
          <SectionTitle eyebrow="THE MATH" title="One formula. No fine print." />
          <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-2xl font-extrabold sm:text-3xl">
            <span>Your players&apos; deposits</span>
            <span aria-hidden="true" className="text-muted">−</span>
            <span>their cashouts</span>
            <span aria-hidden="true" className="text-muted">=</span>
            <span>gross profit</span>
            <span aria-hidden="true" className="text-muted">×</span>
            <span className="text-gold">{rate}</span>
          </p>
          <p className="m-0 text-muted">
            Example: your players deposit {formatCents(example.deposits, { whole: true })} this week and cash out {formatCents(example.cashouts, { whole: true })}. That&apos;s{" "}
            {formatCents(exampleGross, { whole: true })} gross profit, so you get {formatCents(exampleCut, { whole: exampleCut % 100 === 0 })} on Monday.
          </p>
        </section>

        <section id="rules" aria-label="The rules" className="flex scroll-mt-8 flex-col gap-7">
          <SectionTitle title="The rules" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Rule title="Paid every Monday">Weeks run Monday to Sunday. Payouts go out the following Monday, by your usual payment method.</Rule>
            <Rule title="Losing weeks carry forward">
              If your players win more than they deposit, you get $0 that week and the loss comes off your next winning week. The balance stays until your players&apos;
              profit covers it.
            </Rule>
            <Rule title={`${min} minimum payout`}>Weeks under the minimum roll into the next payout. Nothing is lost.</Rule>
            <Rule title="Your players stay yours">
              You earn on every player you bring for as long as you stay an active affiliate. Builders from the old Credit Ladder keep all their players.
            </Rule>
            <Rule title="Your own play doesn't count">
              Commission comes only from players you referred. One account per person: second accounts are removed and their commission is cancelled.
            </Rule>
            <Rule title="Who can join">Anyone can join with their own unique email and phone number. Sign up here, or ask your Young Money rep.</Rule>
            <Rule title="ID check on big payouts">Payouts over {idOver} need a quick ID check before we send. The name on your ID must match your account.</Rule>
          </div>
        </section>

        <section id="race" aria-label="Top 3 race" className="flex scroll-mt-8 flex-col gap-7">
          <SectionTitle
            eyebrow="THE TOP 3 RACE"
            title="Finish top 3. Win big."
            lead={`Every month, the three affiliates whose players generate the most gross profit win a prize. This is on top of the ${rate} you already earn every week.`}
          />
          <div className="grid gap-4 md:grid-cols-3">
            {prizes.map((p, i) => (
              <div key={places[i]} className="flex flex-col gap-3 rounded-card border border-line-gold bg-surface-gold p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-lg font-bold text-gold">{places[i]}</span>
                <h3 className="m-0 font-serif text-3xl font-medium">{p}</h3>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Rule title="How you're ranked">Total gross profit from your players across the whole month. Same number your {rate} is based on.</Rule>
            <Rule title="A new race every month">
              From the 1st to the last day of the month. Winners are announced on the 1st in the group chat, and everyone starts again at zero.
            </Rule>
            <Rule title="Verified winners only">
              Every prize winner verifies ID before the prize is released. A flagged account can&apos;t collect until it&apos;s cleared, and a disqualified one is removed so the
              next affiliate in line moves up. Live standings are on your dashboard.
            </Rule>
          </div>
        </section>

        <section aria-label="Status badges" className="flex flex-col gap-7">
          <SectionTitle title="Earn your status" lead={`Badges are based on what you earned last month. They're pure recognition: everyone gets the same ${rate}.`} />
          <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((b, i) => (
              <li key={b.name} className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4">
                <span className={`font-extrabold ${i === badges.length - 1 ? "text-gold" : ""}`}>{b.name}</span>
                <span className="text-sm text-muted">
                  {b.minCents === 0 ? "Any payout" : `${formatCents(b.minCents, { whole: true })}${i === badges.length - 1 ? "+" : ""} last month`}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section id="join" aria-label="Join" className="flex flex-col items-center gap-5 rounded-[18px] border border-line-gold bg-surface-gold px-6 py-12 text-center sm:px-10">
          <span className="text-xs font-bold tracking-[3px] text-gold">BUILT DIFFERENT</span>
          <h2 className="m-0 font-serif text-4xl font-medium sm:text-5xl">Ready to build?</h2>
          <p className="m-0 max-w-xl text-muted">Create your account now, or message your Young Money rep in the group chat.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/join" className="rounded-full bg-gold px-6 py-3 font-bold text-bg no-underline">
              Become an affiliate
            </Link>
            <a href={chat} className="rounded-full border border-line px-6 py-3 font-bold text-ink no-underline" {...(s.groupChatUrl ? { target: "_blank", rel: "noreferrer" } : {})}>
              Message the team
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
