export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-soft">
      {label}
      <input
        className="rounded-[10px] border border-line bg-bg px-3.5 py-2.5 text-base font-normal text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
        {...input}
      />
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}
