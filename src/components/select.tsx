"use client";

import { useId, useState } from "react";

// A labelled dropdown. Like <Field>, a required one left empty shows a message under it on submit
// instead of the browser's pop-up.

export function Select({
  label,
  options,
  placeholder,
  className = "",
  ...select
}: {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        className={`rounded-[10px] border bg-bg px-3.5 py-2.5 text-base font-normal text-ink focus:outline-none ${error ? "border-orange" : "border-line focus:border-gold"}`}
        defaultValue=""
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...select}
        onChange={(e) => {
          setError(null);
          select.onChange?.(e);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          setError(`Choose ${label.charAt(0).toLowerCase()}${label.slice(1)}.`);
          if (e.currentTarget.form?.querySelector(":invalid") === e.currentTarget) e.currentTarget.focus();
        }}
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
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-xs font-semibold text-orange">
          {error}
        </span>
      ) : null}
    </div>
  );
}
