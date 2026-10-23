"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A row of tabs inside a page (e.g. Verification: IDs to review · Who needs an ID · Flags · Prizes).
// A count shows how many things are waiting on that tab.

export type SubTab = { href: string; label: string; count?: number };

export function SubTabs({ tabs, label }: { tabs: SubTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="m-0 flex list-none gap-1 border-b border-line p-0 whitespace-nowrap">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold no-underline ${
                  active ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.count ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/15 px-1.5 text-[11px] font-extrabold text-gold">
                    {t.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
