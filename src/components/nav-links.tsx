"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** `match`: other pages that belong to this tab (e.g. an entry's page belongs to the Verify queue). */
export type NavItem = { href: string; label: string; match?: string[] };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // The active item is the one whose href (without #hash) or `match` prefix is the longest match for the current path.
  const active = items
    .flatMap((i) => [i.href.split("#")[0], ...(i.match ?? [])].map((prefix) => ({ href: i.href, prefix })))
    .filter(({ prefix }) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.href;

  return (
    <nav aria-label="Main" className="flex gap-1 whitespace-nowrap lg:flex-wrap">
      {items.map((item) => {
        const isActive = item.href === active && !item.href.includes("#");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3.5 py-3 text-sm font-semibold no-underline ${
              isActive ? "border-b-2 border-gold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
