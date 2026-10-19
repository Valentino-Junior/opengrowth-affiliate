// Week (Monday–Sunday) and month boundaries in the business time zone.
// Dates are handled as "YYYY-MM-DD" strings for the local calendar day, so DST never shifts a day.

export const BUSINESS_TZ = process.env.APP_TIMEZONE || "America/New_York";

const dayFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar day an instant falls on in the business time zone. */
export function localDay(at: Date, tz = BUSINESS_TZ): string {
  return dayFmt(tz).format(at); // en-CA formats as YYYY-MM-DD
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type WeekBounds = { startsOn: string; endsOn: string; payoutDate: string };

/** Monday-to-Sunday week containing `at`, paid the following Monday. */
export function weekFor(at: Date, tz = BUSINESS_TZ): WeekBounds {
  const day = localDay(at, tz);
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const startsOn = addDays(day, dow === 0 ? -6 : 1 - dow);
  return { startsOn, endsOn: addDays(startsOn, 6), payoutDate: addDays(startsOn, 7) };
}

/** First day of the race month containing `at`. */
export function monthFor(at: Date, tz = BUSINESS_TZ): string {
  return `${localDay(at, tz).slice(0, 7)}-01`;
}

/** Minutes the time zone is ahead of UTC at instant `at` (New York in October: −240). */
function tzOffsetMinutes(at: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at) / 60_000);
}

/** A wall-clock time typed in the business time zone ("2026-10-19T10:42") → the real instant. */
export function zonedLocalToDate(local: string, tz = BUSINESS_TZ): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`Not a local date-time: ${local}`);
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset across a DST change.
  let t = naive - tzOffsetMinutes(naive, tz) * 60_000;
  t = naive - tzOffsetMinutes(t, tz) * 60_000;
  return new Date(t);
}

/** The instant as "YYYY-MM-DDTHH:mm" wall-clock time in the business time zone (for datetime-local inputs). */
export function dateToZonedLocal(at: Date, tz = BUSINESS_TZ): string {
  return new Date(at.getTime() + tzOffsetMinutes(at.getTime(), tz) * 60_000).toISOString().slice(0, 16);
}

const MONTHS =["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 12–18" or "Sep 29–Oct 5" */
export function formatWeekRange(w: Pick<WeekBounds, "startsOn" | "endsOn">): string {
  const [, sm, sd] = w.startsOn.split("-").map(Number);
  const [, em, ed] = w.endsOn.split("-").map(Number);
  const start = `${MONTHS[sm - 1]} ${sd}`;
  return sm === em ? `${start}–${ed}` : `${start}–${MONTHS[em - 1]} ${ed}`;
}
