"use client";

import { useId, useMemo, useRef, useState } from "react";

// Pick a player without typing: the field is a button; clicking it opens a centred window listing players
// (with a search box for long lists). The chosen handle is submitted as `name`.

export type PickablePlayer = { handle: string; affiliate: string | null };

export function PlayerPicker({ label, name, players }: { label: string; name: string; players: PickablePlayer[] }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? players.filter((p) => p.handle.toLowerCase().includes(q) || p.affiliate?.toLowerCase().includes(q)) : players;
  }, [players, query]);
  const chosen = players.find((p) => p.handle === value);

  const open = () => {
    setQuery("");
    dialog.current?.showModal();
  };
  const pick = (handle: string) => {
    setValue(handle);
    setError(null);
    dialog.current?.close();
    trigger.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-semibold text-ink-soft">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border bg-bg px-3.5 py-2.5 text-left text-base hover:border-gold focus:border-gold focus:outline-none ${
          error ? "border-orange" : "border-line"
        }`}
      >
        <span id={`${id}-value`} className={chosen ? "font-semibold text-ink" : "text-muted/70"}>
          {chosen ? chosen.handle : "Choose a player…"}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {/* Carries the value into the form and makes "required" work; never shown or typed in. */}
      <input
        name={name}
        value={value}
        onChange={() => {}}
        required
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onInvalid={(e) => {
          e.preventDefault();
          setError("Choose a player.");
          if (e.currentTarget.form?.querySelector(":invalid") === e.currentTarget) trigger.current?.focus();
        }}
      />
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-xs font-semibold text-orange">
          {error}
        </span>
      ) : null}

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()} // click outside closes
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 id={`${id}-title`} className="m-0 text-lg font-extrabold">
              Choose a player
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line text-muted hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search by player or affiliate"
            aria-label="Search players"
            className="rounded-[10px] border border-line bg-bg px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
          />
          <ul className="m-0 flex max-h-[55vh] list-none flex-col gap-1 overflow-y-auto p-0" aria-label="Players">
            {shown.length === 0 ? <li className="py-6 text-center text-sm text-muted">No player matches “{query}”.</li> : null}
            {shown.map((p) => (
              <li key={p.handle}>
                <button
                  type="button"
                  onClick={() => pick(p.handle)}
                  aria-pressed={p.handle === value}
                  className={`flex w-full cursor-pointer flex-col items-center rounded-[10px] border px-3 py-2 text-center hover:border-gold ${
                    p.handle === value ? "border-gold bg-gold/10" : "border-transparent"
                  }`}
                >
                  <span className="font-semibold">{p.handle}</span>
                  <span className="text-xs text-muted">{p.affiliate ?? "No affiliate"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  );
}
