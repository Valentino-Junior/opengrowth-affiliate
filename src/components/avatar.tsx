import type { CurrentUser } from "@/lib/auth";

/** The name people see for this account: legal name for affiliates, display name for staff. */
export function displayName(user: Pick<CurrentUser, "email" | "affiliate" | "staff">): string {
  return user.affiliate?.legalName ?? user.staff?.displayName ?? user.email;
}

/** "Jordan Newcomer" → "JN", "Affiliate 01" → "AF" (only words that start with a letter count). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-20 w-20 text-2xl" : "h-8 w-8 text-xs";
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-gold font-extrabold text-bg ${box}`}>
      {initials(name)}
    </span>
  );
}
