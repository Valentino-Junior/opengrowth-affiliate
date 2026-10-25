"use client";

import { useId, useRef } from "react";
import { Button } from "./ui";

// A button that opens a centred window with whatever is passed as children (usually a form).
// ✕, Esc or a click outside closes it.

export function ModalButton({
  label,
  title,
  description,
  variant,
  plus = true,
  className,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  variant?: "gold" | "ghost" | "danger";
  /** The "+" icon, for buttons that add something. */
  plus?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
        {plus ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ) : null}
        {label}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`${id}-title`} className="m-0 text-xl font-extrabold">
                {title}
              </h2>
              {description ? <p className="m-0 mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-muted hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
