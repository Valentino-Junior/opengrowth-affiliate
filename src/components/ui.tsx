// Small presentational building blocks shared by every screen, matching the mockups.

import Link from "next/link";

export function Brand({ suffix, tag }: { suffix?: string; tag?: string }) {
  return (
    <Link href="/" className="flex items-center gap-3.5 no-underline">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-[17px] font-bold tracking-[0.5px] text-gold">
        OG
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-extrabold tracking-[3px] text-ink">
          OPENGROWTH{suffix ? ` · ${suffix}` : ""}
        </span>
        <span className="text-[11px] tracking-[2px] text-muted">{tag ?? "BY YOUNG MONEY"}</span>
      </span>
    </Link>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold tracking-[3px] text-gold">{children}</span>;
}

export function PageTitle({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="m-0 font-serif text-4xl leading-[1.05] font-medium sm:text-5xl">{title}</h1>
      {lead ? <p className="m-0 text-base text-muted">{lead}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  tone = "default",
  ...rest
}: { children: React.ReactNode; className?: string; tone?: "default" | "gold" | "green" } & React.HTMLAttributes<HTMLElement>) {
  const tones = {
    default: "bg-surface border-line",
    gold: "bg-surface-gold border-line-gold",
    green: "bg-surface-green border-line-green",
  };
  return (
    <section className={`rounded-card border p-6 ${tones[tone]} ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function Stat({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: "gold" | "green" }) {
  const color = accent === "gold" ? "text-gold" : accent === "green" ? "text-green" : "text-ink";
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-4 sm:p-[22px]">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className={`text-3xl font-extrabold sm:text-4xl ${color}`}>{value}</span>
      {note ? <span className="text-[13px] text-muted">{note}</span> : null}
    </div>
  );
}

const pillTones = {
  green: "border-green/40 text-green bg-green/10",
  gold: "border-gold/40 text-gold bg-gold/10",
  orange: "border-orange/40 text-orange bg-orange/10",
  grey: "border-line text-muted bg-white/5",
  red: "border-red/40 text-red bg-red/10",
  blue: "border-blue/40 text-blue bg-blue/10",
};

/** `pulse` adds a softly pulsing dot for "in progress" states (still when the person prefers reduced motion). */
export function Pill({ tone, pulse = false, children }: { tone: keyof typeof pillTones; pulse?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${pillTones[tone]}`}>
      {pulse ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" /> : null}
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "gold",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" | "danger" }) {
  const variants = {
    gold: "bg-gold text-bg hover:brightness-110",
    ghost: "border border-line text-ink hover:border-muted",
    danger: "border border-red/50 text-red hover:bg-red/10",
  };
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ComingSoon({ title, phase, children }: { title: string; phase: number; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-extrabold">{title}</h2>
        <Pill tone="grey">Phase {phase}</Pill>
      </div>
      <p className="m-0 text-sm text-muted">{children}</p>
    </Card>
  );
}
