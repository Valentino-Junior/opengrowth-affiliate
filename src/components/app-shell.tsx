import Link from "next/link";
import type { Role } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Avatar, displayName } from "./avatar";
import { NotificationBell } from "./notification-bell";
import { Brand } from "./ui";
import { NavLinks, type NavItem } from "./nav-links";

type Area = "affiliate" | "desk" | "ops" | "admin";

const ops: NavItem[] = [
  { href: "/ops", label: "Overview" },
  { href: "/ops/payouts", label: "Payout run" },
  { href: "/ops/verification", label: "Verification" },
  { href: "/ops/affiliates", label: "Affiliates" },
  { href: "/ops/transactions", label: "Transactions", match: ["/ops/entries"] },
];

function navFor(area: Area, role: Role): NavItem[] {
  switch (area) {
    case "affiliate":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard/players", label: "My players" },
        { href: "/dashboard/payouts", label: "Payouts" },
        { href: "/dashboard/how-it-works", label: "How it works" },
      ];
    case "desk":
      return [
        { href: "/desk", label: "Overview" },
        { href: "/desk/new-players", label: "New players" },
        { href: "/desk/log", label: "Log transaction" },
        { href: "/desk/queue", label: "Verify queue", match: ["/desk/entries"] },
      ];
    case "ops":
    case "admin":
      // Admin runs ops too: same tabs, with Settings last.
      return role === "admin" ? [...ops, { href: "/admin/settings", label: "Settings" }] : ops;
  }
}

const brandFor: Record<Area, { suffix?: string; tag?: string }> = {
  affiliate: {},
  desk: { suffix: "DESK", tag: "EMPLOYEES ONLY" },
  ops: { suffix: "OPS", tag: "MANAGEMENT ONLY" },
  admin: { suffix: "ADMIN", tag: "OWNER ONLY" },
};

/** Admin can work in both areas; this flips between them. */
function AreaSwitch({ current }: { current: "ops" | "desk" }) {
  const areas = [
    { key: "ops", href: "/ops", label: "Ops" },
    { key: "desk", href: "/desk", label: "Desk" },
  ] as const;
  return (
    <nav aria-label="Area" className="flex rounded-full border border-line p-0.5 text-xs font-bold">
      {areas.map((a) => (
        <Link
          key={a.key}
          href={a.href}
          aria-current={a.key === current ? "page" : undefined}
          className={`rounded-full px-3 py-1 no-underline ${a.key === current ? "bg-gold text-bg" : "text-muted hover:text-ink"}`}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ area, user, children }: { area: Area; user: CurrentUser; children: React.ReactNode }) {
  const name = displayName(user);
  return (
    <>
      <header className="border-b border-line px-4 sm:px-8">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4">
            <Brand {...brandFor[area]} />
            {user.role === "admin" ? <AreaSwitch current={area === "desk" ? "desk" : "ops"} /> : null}
          </div>
          <div className="order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 lg:order-none lg:mx-0 lg:w-auto lg:px-0">
            <NavLinks items={navFor(area, user.role)} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell />
            <Link
              href="/account"
              aria-label={`My profile: ${name}`}
              className="flex items-center gap-2 rounded-full border border-transparent py-1 pr-3 pl-1 text-ink no-underline hover:border-line"
            >
              <Avatar name={name} />
              <span className="hidden sm:inline">{name}</span>
            </Link>
            <form action={logoutAction}>
              <button className="cursor-pointer rounded-full border border-line px-3 py-1.5 font-semibold text-ink hover:border-muted">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pt-10 pb-16 sm:px-8">{children}</main>
    </>
  );
}
