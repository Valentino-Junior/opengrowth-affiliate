"use client";

import { useId, useState } from "react";

// A labelled input used by every form.
// - Password fields get an eye button to show / hide what was typed.
// - On submit, the browser's own checks (required, email, min length) are shown as a message under the field
//   instead of the browser's pop-up. The server re-checks everything; this is only for quick feedback.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PICKER_TYPES = new Set(["date", "datetime-local", "time", "month", "week"]);

/** Current wall-clock time in a time zone, as a datetime-local value ("2026-10-23T14:05"). */
function nowIn(timeZone: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function messageFor(el: HTMLInputElement, label: string): string {
  const v = el.validity;
  if (v.valueMissing) return `Enter ${label.charAt(0).toLowerCase()}${label.slice(1)}.`;
  if (el.type === "email" && (v.typeMismatch || v.customError)) return "Enter a valid email address, like name@example.com.";
  if (v.tooShort) return `${label}: at least ${el.minLength} characters.`;
  if (v.rangeOverflow && el.type === "datetime-local") return "That time is in the future. Pick when it actually happened.";
  if (v.typeMismatch && el.type === "url") return "Enter a full link starting with https://";
  return el.validationMessage;
}

export function Field({
  label,
  hint,
  type = "text",
  className,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  // Email needs a real domain too ("name@site.com"), which the browser's own check doesn't insist on.
  const checkEmail = (el: HTMLInputElement) => {
    if (type !== "email") return;
    el.setCustomValidity(el.value && !EMAIL.test(el.value.trim()) ? "invalid email" : "");
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full rounded-[10px] border bg-bg px-3.5 py-2.5 text-base font-normal text-ink placeholder:text-muted/60 focus:outline-none ${
            error ? "border-orange focus:border-orange" : "border-line focus:border-gold"
          } ${isPassword ? "pr-12" : ""}`}
          {...input}
          onChange={(e) => {
            checkEmail(e.currentTarget);
            // Once a message is showing, update it live as the person fixes the field.
            if (error) setError(e.currentTarget.validity.valid ? null : messageFor(e.currentTarget, label));
            input.onChange?.(e);
          }}
          onBlur={(e) => {
            checkEmail(e.currentTarget);
            input.onBlur?.(e);
          }}
          onClick={(e) => {
            // Date/time fields: open the picker wherever the box is clicked, not only on the small icon.
            const el = e.currentTarget;
            // data-max-now="America/New_York": no time later than right now in that zone.
            if (el.dataset.maxNow) el.max = nowIn(el.dataset.maxNow);
            if (PICKER_TYPES.has(el.type) && !el.readOnly && !el.disabled) {
              try {
                el.showPicker();
              } catch {
                // older browsers: the normal typing behaviour still works
              }
            }
            input.onClick?.(e);
          }}
          onInvalid={(e) => {
            e.preventDefault(); // no browser pop-up; show our message instead
            const el = e.currentTarget;
            setError(messageFor(el, label));
            if (el.form?.querySelector(":invalid") === el) el.focus();
          }}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-[10px] text-muted hover:text-ink focus-visible:text-gold"
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-xs font-semibold text-orange">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-xs font-normal text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.4 3.4" />
      <path d="M6.6 6.6C3.8 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}
