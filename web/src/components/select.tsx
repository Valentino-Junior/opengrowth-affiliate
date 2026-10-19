export function Select({
  label,
  options,
  placeholder,
  ...select
}: {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-soft">
      {label}
      <select
        className="rounded-[10px] border border-line bg-bg px-3.5 py-2.5 text-base font-normal text-ink focus:border-gold focus:outline-none"
        defaultValue=""
        {...select}
      >
        {placeholder !== undefined ? (
          <option value="" disabled={select.required}>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
