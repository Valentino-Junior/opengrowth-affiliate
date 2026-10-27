import { formatCents, formatRate } from "@/lib/money";
import type { Settings } from "@/lib/settings";

// The program explained: three steps, the math, the rules, the Top 3 race and the badges.
// The public home page lays the sections out centred (`center`); the affiliate's in-app How it works page uses
// HowItWorksSections, left-aligned. Every number comes from settings.

export function SectionTitle({ eyebrow, title, lead, center = false }: { eyebrow?: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={`flex max-w-2xl flex-col gap-3 ${center ? "mx-auto items-center text-center" : ""}`}>
      {eyebrow ? <span className="text-xs font-bold tracking-[3px] text-gold">{eyebrow}</span> : null}
      <h2 className="m-0 font-serif text-4xl leading-[1.05] font-medium text-balance sm:text-5xl">{title}</h2>
      {lead ? <p className="m-0 text-base text-muted">{lead}</p> : null}
    </div>
  );
}

function Rule({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-card border border-line bg-surface p-6 transition-colors hover:border-line-gold ${className}`}>
      <h3 className="m-0 text-lg font-extrabold">{title}</h3>
      <p className="m-0 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

type Props = { settings: Settings; center?: boolean };

/** The worked example used by the math section (and the home page's earnings card). */
export function example(s: Settings) {
  const deposits = 745_000;
  const cashouts = 445_000;
  const gross = deposits - cashouts;
  const cut = Math.floor((gross * s.commissionRateBp) / 10_000);
  return { deposits, cashouts, gross, cut };
}

export function exampleSentence(s: Settings) {
  const e = example(s);
  return `Example: your players deposit ${formatCents(e.deposits, { whole: true })} this week and cash out ${formatCents(e.cashouts, { whole: true })}. That's ${formatCents(e.gross, { whole: true })} gross profit, so you get ${formatCents(e.cut, { whole: e.cut % 100 === 0 })} on Monday.`;
}

export function Steps({ settings: s, center }: Props) {
  const rate = formatRate(s.commissionRateBp);
  const steps = [
    ["01", "Get your code", "Sign up here or message our team. Once you're approved you get a personal OG code and link."],
    ["02", "Bring players in", "New players sign up with your link or give your code when they join. They're linked to you for as long as you stay active."],
    ["03", "Get paid Monday", `Every Monday we total your players' week and send you ${rate} of the gross profit.`],
  ];
  return (
    <section id="how-it-works" aria-label="Three steps" className="flex scroll-mt-24 flex-col gap-8">
      <SectionTitle title="Three steps. That's it." center={center} />
      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {steps.map(([n, title, body]) => (
          <li key={n} className={`flex flex-col gap-3 rounded-card border border-line bg-surface p-6 ${center ? "items-center text-center sm:p-8" : ""}`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line-gold bg-surface-gold font-serif text-xl text-gold">{n}</span>
            <h3 className="m-0 text-xl font-extrabold">{title}</h3>
            <p className="m-0 text-sm leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TheMath({ settings: s }: Props) {
  const rate = formatRate(s.commissionRateBp);
  return (
    <section aria-label="The math" className="flex flex-col gap-6 rounded-[18px] border border-line-gold bg-surface-gold p-6 sm:p-10">
      <SectionTitle eyebrow="THE MATH" title="One formula. No fine print." />
      <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-2xl font-extrabold sm:text-3xl">
        <span>Your players&apos; deposits</span>
        <span aria-hidden="true" className="text-muted">
          −
        </span>
        <span>their cashouts</span>
        <span aria-hidden="true" className="text-muted">
          =
        </span>
        <span>gross profit</span>
        <span aria-hidden="true" className="text-muted">
          ×
        </span>
        <span className="text-gold">{rate}</span>
      </p>
      <p className="m-0 text-muted">{exampleSentence(s)}</p>
    </section>
  );
}

export function Rules({ settings: s, center }: Props) {
  const min = formatCents(s.minPayoutCents, { whole: true });
  const idOver = formatCents(s.idThresholdCents, { whole: true });
  return (
    <section id="rules" aria-label="The rules" className="flex scroll-mt-24 flex-col gap-8">
      <SectionTitle title="The rules" lead={center ? "Short, clear and the same for everyone." : undefined} center={center} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Rule title="Paid every Monday">Weeks run Monday to Sunday. Payouts go out the following Monday, by your usual payment method.</Rule>
        <Rule title="Losing weeks carry forward">
          If your players win more than they deposit, you get $0 that week and the loss comes off your next winning week. The balance stays until your
          players&apos; profit covers it.
        </Rule>
        <Rule title={`${min} minimum payout`}>Weeks under the minimum roll into the next payout. Nothing is lost.</Rule>
        <Rule title="Your players stay yours">
          You earn on every player you bring for as long as you stay an active affiliate. Builders from the old Credit Ladder keep all their players.
        </Rule>
        <Rule title="Your own play doesn't count">
          Commission comes only from players you referred. One account per person: second accounts are removed and their commission is cancelled.
        </Rule>
        <Rule title="Who can join">Anyone can join with their own unique email and phone number. Sign up here, or ask your Young Money rep.</Rule>
        <Rule title="ID check on big payouts" className="md:col-span-2 md:items-center md:text-center lg:col-span-3">
          Payouts over {idOver} need a quick ID check before we send. The name on your ID must match your account.
        </Rule>
      </div>
    </section>
  );
}

export function Race({ settings: s, center }: Props) {
  const rate = formatRate(s.commissionRateBp);
  const prizes = [
    { place: "1st", prize: s.prizes.first },
    { place: "2nd", prize: s.prizes.second },
    { place: "3rd", prize: s.prizes.third },
  ];
  return (
    <section id="race" aria-label="Top 3 race" className="flex scroll-mt-24 flex-col gap-8">
      <SectionTitle
        eyebrow="THE TOP 3 RACE"
        title="Finish top 3. Win big."
        lead={`Every month, the three affiliates whose players generate the most gross profit win a prize. This is on top of the ${rate} you already earn every week.`}
        center={center}
      />
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        {prizes.map((p, i) => (
          <div
            key={p.place}
            // On wide screens 1st stands in the middle, raised, like a podium.
            className={`flex flex-col items-center gap-4 rounded-card border p-6 text-center sm:p-8 ${
              i === 0 ? "border-gold bg-surface-gold md:order-2 md:pb-12" : `border-line-gold bg-surface-gold/60 ${i === 1 ? "md:order-1" : "md:order-3"}`
            }`}
          >
            <span
              className={`flex items-center justify-center rounded-full border-[1.5px] border-gold font-serif font-bold text-gold ${i === 0 ? "h-16 w-16 text-xl" : "h-12 w-12 text-lg"}`}
            >
              {p.place}
            </span>
            <h3 className={`m-0 font-serif font-medium ${i === 0 ? "text-4xl" : "text-3xl"}`}>{p.prize}</h3>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Rule title="How you're ranked">Total gross profit from your players across the whole month. Same number your {rate} is based on.</Rule>
        <Rule title="A new race every month">
          From the 1st to the last day of the month. Winners are announced on the 1st in the group chat, and everyone starts again at zero.
        </Rule>
        <Rule title="Verified winners only">
          Every prize winner verifies ID before the prize is released. A flagged account can&apos;t collect until it&apos;s cleared, and a disqualified one is
          removed so the next affiliate in line moves up. Live standings are on your dashboard.
        </Rule>
      </div>
    </section>
  );
}

export function Badges({ settings: s, center }: Props) {
  const rate = formatRate(s.commissionRateBp);
  const badges = s.badgeThresholds;
  return (
    <section aria-label="Status badges" className="flex flex-col gap-8">
      <SectionTitle
        title="Earn your status"
        lead={`Badges are based on what you earned last month. They're pure recognition: everyone gets the same ${rate}.`}
        center={center}
      />
      <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((b, i) => (
          <li
            key={b.name}
            className={`flex items-center justify-between gap-3 rounded-card border px-5 py-4 ${
              i === badges.length - 1 ? "border-gold bg-surface-gold" : "border-line bg-surface"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="font-serif text-sm text-gold">{String(i + 1).padStart(2, "0")}</span>
              <span className={`font-extrabold ${i === badges.length - 1 ? "text-gold" : ""}`}>{b.name}</span>
            </span>
            <span className="text-sm text-muted">
              {b.minCents === 0 ? "Any payout" : `${formatCents(b.minCents, { whole: true })}${i === badges.length - 1 ? "+" : ""} last month`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Everything, left-aligned, for the affiliate's in-app How it works page. */
export function HowItWorksSections({ settings }: { settings: Settings }) {
  return (
    <>
      <Steps settings={settings} />
      <TheMath settings={settings} />
      <Rules settings={settings} />
      <Race settings={settings} />
      <Badges settings={settings} />
    </>
  );
}
