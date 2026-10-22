import Link from "next/link";
import type { Role } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Avatar, displayName } from "./avatar";
import { Brand } from "./ui";
import { NavLinks, type NavItem } from "./nav-links";

type Area = "affiliate" | "desk" | "ops" | "admin";

const ops: NavItem[] = [
  { href: "/ops/payouts", label: "Payout run" },
  { href: "/desk", label: "Transaction desk" },
  { href: "/ops/verification", label: "Verification" },
  { href: "/ops/affiliates#tag", label: "Tag a player" },
  { href: "/ops/affiliates", label: "All affiliates" },
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
        { href: "/desk/queue", label: "Verify queue" },
        ...(role === "employee" ? [] : [{ href: "/ops/payouts", label: "Payout run" }]),
      ];
    case "ops":
      return role === "admin" ? [...ops, { href: "/admin/settings", label: "Settings" }] : ops;
    case "admin":
      return [{ href: "/admin/settings", label: "Settings" }, ...ops];
  }
}

const brandFor: Record<Area, { suffix?: string; tag?: string }> = {
  affiliate: {},
  desk: { suffix: "DESK", tag: "EMPLOYEES ONLY" },
  ops: { suffix: "OPS", tag: "MANAGEMENT ONLY" },
  admin: { suffix: "ADMIN", tag: "OWNER ONLY" },
};

export function AppShell({ area, user, children }: { area: Area; user: CurrentUser; children: React.ReactNode }) {
  const name = displayName(user);
  return (
    <>
      <header className="border-b border-line px-4 sm:px-8">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] flex-wrap items-center justify-between gap-4 py-3">
          <Brand {...brandFor[area]} />
          <div className="order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 lg:order-none lg:mx-0 lg:w-auto lg:px-0">
            <NavLinks items={navFor(area, user.role)} />
          </div>
          <div className="flex items-center gap-3 text-sm">
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
