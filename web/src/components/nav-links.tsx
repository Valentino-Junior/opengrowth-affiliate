"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // The active item is the longest href (without #hash) that the current path starts with.
  const active = items
    .map((i) => i.href.split("#")[0])
    .filter((p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`)))
    .sort((a, b) => b.length - a.length)[0];

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
