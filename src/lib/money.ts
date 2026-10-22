// All money is integer cents (bigint). These helpers are the only place cents become text.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** $1,580.00 — negative values use a real minus sign: −$260.00 */
export function formatCents(cents: bigint | number, opts: { whole?: boolean } = {}): string {
  const n = Number(cents) / 100;
  const text = (opts.whole ? usdWhole : usd).format(Math.abs(n));
  return n < 0 ? `−${text}` : text;
}

/** +$800 / −$150 / $0, as in the players table. */
export function formatSignedCents(cents: bigint | number): string {
  const n = Number(cents);
  if (n === 0) return formatCents(0, { whole: true });
  return n > 0 ? `+${formatCents(n, { whole: true })}` : formatCents(n, { whole: true });
}

/** "12.50" or "12" → 1250n. Throws on anything that is not a non-negative dollar amount with at most 2 decimals. */
export function dollarsToCents(input: string): bigint {
  const s = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Not a dollar amount: "${input}"`);
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}

/** Basis points → "5%" (500 bp). */
export function formatRate(bp: number): string {
  return `${bp / 100}%`;
}
