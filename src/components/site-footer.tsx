import Link from "next/link";
import { connection } from "next/server";
import { localDay } from "@/lib/weeks";

/** Site-wide footer. The year is read on every request (New York time), so it rolls over on its own each January 1st. */
export async function SiteFooter() {
  await connection(); // never bake the year into a cached page
  const year = localDay(new Date()).slice(0, 4);

  return (
    <footer className="border-t border-line px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-sm font-bold text-gold" aria-hidden="true">
          OG
        </span>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
          <Link href="/" className="text-muted no-underline hover:text-ink">
            How it works
          </Link>
          <Link href="/#rules" className="text-muted no-underline hover:text-ink">
            Rules
          </Link>
          <Link href="/join" className="text-muted no-underline hover:text-ink">
            Become an affiliate
          </Link>
          <Link href="/login" className="text-muted no-underline hover:text-ink">
            Log in
          </Link>
        </nav>
        <p className="m-0 text-xs text-muted">
          © {year} Opengrowth by Young Money. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
