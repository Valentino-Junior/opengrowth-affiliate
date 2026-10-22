import Link from "next/link";
import { AREA_ROLES, requireRole } from "@/lib/auth";
import { activePlayerCount, lastPayout, payoutHistory, playersForWeek, statusBadge } from "@/lib/affiliate-stats";
import { formatCents, formatRate } from "@/lib/money";
import { appOrigin } from "@/lib/origin";
import { monthLabel, prizeNames, standings } from "@/lib/race";
import { getSettings } from "@/lib/settings";
import { liveWeekTotals } from "@/lib/transactions";
import { formatWeekRange, localDay } from "@/lib/weeks";
import { CopyCode } from "@/components/copy-code";
import { MathStrip, PayoutHistory, PlayersTable, StatusBadge } from "@/components/dashboard-bits";
import { Card, PageTitle, Pill, Stat } from "@/components/ui";

/** "A car" → "a car", "An iPhone" → "an iPhone": prize names read mid-sentence. */
const inSentence = (prize: string) => prize.replace(/^(A|An|The) /, (m) => m.toLowerCase());

const payDay = (d: Date) =>
  new Date(`${d.toISOString().slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireRole(AREA_ROLES.affiliate);
  const affiliate = user.affiliate!;
  const settings = await getSettings();
  const rate = formatRate(settings.commissionRateBp);
  const firstName = affiliate.legalName.split(" ")[0];
  const { id: idParam } = await searchParams;

  if (!affiliate.referralCode)
    return (
      <>
        <PageTitle eyebrow="AFFILIATE DASHBOARD" title={`Welcome, ${firstName}`} lead={`You'll earn ${rate} of the gross profit from every player you bring in.`} />
        <Card tone="gold">
          <p className="m-0 text-sm">
            Your account is waiting for approval by the team. Your OG code appears here as soon as it is approved.
          </p>
        </Card>
      </>
    );

  const month = `${localDay(new Date()).slice(0, 7)}-01`;
  const [live, badge, last, active, table, history, prizes, referralLink] = await Promise.all([
    liveWeekTotals(affiliate.id),
    statusBadge(affiliate.id, settings),
    lastPayout(affiliate.id),
    activePlayerCount(affiliate.id),
    standings(month),
    payoutHistory(affiliate.id, 4),
    prizeNames(),
    appOrigin().then((o) => `${o}/r/${affiliate.referralCode}`),
  ]);
  const weekPlayers = await playersForWeek(affiliate.id, live.bounds);

  const liveGross = live.depositsCents - live.cashoutsCents;
  const liveCommission = liveGross > 0n ? (liveGross * BigInt(settings.commissionRateBp)) / 10_000n : 0n;
  const me = table.find((s) => s.affiliateId === affiliate.id);
  const third = table[2];
  const gapTo3rd = me && third && me.rank > 3 ? third.grossCents - me.grossCents : null;

  const idPill = {
    none: <Pill tone="gold">ID not on file yet</Pill>,
    submitted: <Pill tone="grey">ID under review</Pill>,
    verified: <Pill tone="green">ID verified</Pill>,
    rejected: <Pill tone="orange">ID rejected: upload again</Pill>,
  }[affiliate.idStatus];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <PageTitle eyebrow="AFFILIATE DASHBOARD" title={`Welcome back, ${firstName}`} lead={`You earn ${rate} of the gross profit from every player you bring in. Paid every Monday.`} />
        <StatusBadge name={badge.name} />
      </div>

      {idParam === "submitted" ? (
        <Card tone="green">
          <p className="m-0 text-sm">Thanks. Your ID is with the team for review.</p>
        </Card>
      ) : null}

      <section aria-label="Key numbers" className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <Stat
          label="This week so far"
          value={formatCents(liveCommission)}
          note={`${rate} of ${formatCents(liveGross, { whole: true })} gross profit · ${formatWeekRange(live.bounds)}`}
          accent="gold"
        />
        <Stat label="Last payout" value={last ? formatCents(last.payableCents) : "$0.00"} note={last ? `Paid ${payDay(last.week.payoutDate)}` : "No payout yet"} />
        <Stat label="Active players" value={String(active)} note="Deposited in the last 30 days" />
        <Stat
          label="Carry-forward balance"
          value={formatCents(affiliate.carryForwardCents)}
          note="Comes off your next winning week"
          accent={affiliate.carryForwardCents === 0n ? "green" : undefined}
        />
      </section>

      <MathStrip deposits={live.depositsCents} cashouts={live.cashoutsCents} gross={liveGross} rate={rate} commission={liveCommission} />

      <Card tone="gold" aria-label="Top 3 race" className="flex flex-wrap items-center gap-x-10 gap-y-6">
        <div className="flex max-w-md flex-col gap-3">
          <span className="text-xs font-bold tracking-[3px] text-gold">TOP 3 RACE · {monthLabel(month).toUpperCase()}</span>
          <h2 className="m-0 font-serif text-3xl leading-tight font-medium">
            {!me
              ? "Get on the board this month."
              : me.rank <= 3
                ? `You're #${me.rank}. Hold your spot.`
                : `You're #${me.rank}. ${formatCents(gapTo3rd!, { whole: true })} behind 3rd place.`}
          </h2>
          <p className="m-0 text-sm text-muted">
            Top 3 affiliates by gross profit this month win {inSentence(prizes[0])}, {inSentence(prizes[1])} or {inSentence(prizes[2])}. On top of your {rate}. Winners verify
            ID before prizes are released.
          </p>
          <Link href="/dashboard/how-it-works#race" className="text-sm font-bold text-gold">
            See the prizes and rules
          </Link>
        </div>
        <ol className="m-0 flex min-w-[260px] flex-1 list-none flex-col gap-2 p-0">
          {table.slice(0, 3).map((s, i) => (
            <li key={s.affiliateId} className={`flex items-center gap-3 rounded-[10px] border px-4 py-2.5 ${s.affiliateId === affiliate.id ? "border-gold bg-gold/10" : "border-line-gold"}`}>
              <span className="w-5 font-serif text-xl text-gold">{s.rank}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-bold">{s.affiliateId === affiliate.id ? "You" : s.name}</span>
                <span className="text-xs text-muted">Wins {inSentence(prizes[i])}</span>
              </span>
              <span className="font-extrabold">{formatCents(s.grossCents, { whole: true })}</span>
            </li>
          ))}
          {me && me.rank > 3 ? (
            <li className="flex items-center gap-3 rounded-[10px] border border-gold bg-gold/10 px-4 py-2.5">
              <span className="w-5 font-serif text-xl text-gold">{me.rank}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-bold">You</span>
                <span className="text-xs text-muted">{formatCents(gapTo3rd!, { whole: true })} to 3rd place</span>
              </span>
              <span className="font-extrabold">{formatCents(me.grossCents, { whole: true })}</span>
            </li>
          ) : null}
          {table.length === 0 ? <li className="text-sm text-muted">No verified profit yet this month.</li> : null}
        </ol>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4" aria-label="Account verification">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-xl font-extrabold">Account verification</h2>
          <div className="flex flex-wrap gap-2">
            <Pill tone={user.emailVerifiedAt ? "green" : "gold"}>{user.emailVerifiedAt ? "Email verified" : "Email not verified"}</Pill>
            <Pill tone={user.phoneVerifiedAt ? "green" : "gold"}>{user.phoneVerifiedAt ? "Phone verified" : "Phone not verified"}</Pill>
            {idPill}
          </div>
          <span className="text-xs text-muted">Needed for payouts over {formatCents(settings.idThresholdCents, { whole: true })} and Top 3 prizes.</span>
        </div>
        {affiliate.idStatus === "none" || affiliate.idStatus === "rejected" ? (
          <Link href="/dashboard/verify" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-bg no-underline">
            Verify my ID
          </Link>
        ) : null}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4" aria-label="Referral code">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-muted">Your referral code</span>
          <span className="font-serif text-3xl font-bold text-gold">{affiliate.referralCode}</span>
          <span className="text-sm text-muted">
            New players give this code to our team, or sign up with your link: <span className="font-semibold break-all text-ink">{referralLink}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyCode code={affiliate.referralCode} />
          <CopyCode code={referralLink} label="Copy link" variant="ghost" />
        </div>
      </Card>

      <div className="flex flex-wrap gap-7">
        <Card id="players" aria-label="My players this week" className="min-w-0 flex-[999_1_560px] !px-0">
          <div className="mb-2 flex items-baseline justify-between px-6">
            <h2 className="m-0 text-xl font-extrabold">My players this week</h2>
            <Link href="/dashboard/players" className="text-sm text-muted">
              Showing {Math.min(6, weekPlayers.length)} of {weekPlayers.length}
            </Link>
          </div>
          <PlayersTable rows={weekPlayers.slice(0, 6)} empty="No confirmed players yet. Share your code to get started." />
        </Card>
        <Card id="payouts" aria-label="Payout history" className="flex min-w-0 flex-[1_1_340px] flex-col gap-1">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="m-0 text-xl font-extrabold">Payout history</h2>
            <Link href="/dashboard/payouts" className="text-sm text-muted">
              All
            </Link>
          </div>
          <PayoutHistory rows={history} />
        </Card>
      </div>
    </>
  );
}
