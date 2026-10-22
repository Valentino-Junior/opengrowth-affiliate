"use client";

import { useEffect, useId, useRef, useState } from "react";

// Image upload field: pick a file, see a preview with its name and size, and remove it with ✕ to pick another.
// The real <input type="file"> stays in the form (hidden while a file is shown), so the file is submitted as usual.

const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function FileField({ label, name, hint, accept = "image/png,image/jpeg,image/webp", required }: { label: string; name: string; hint?: string; accept?: string; required?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Free the preview image when it's replaced or the field goes away.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const remove = () => {
    if (input.current) input.current.value = "";
    setFile(null);
    setPreview(null);
    input.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${file ? "sr-only" : ""} rounded-[10px] border border-dashed bg-bg px-3.5 py-3 text-sm font-normal text-muted file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-surface file:px-4 file:py-1.5 file:font-bold file:text-ink ${
          error ? "border-orange" : "border-line"
        }`}
        onChange={(e) => {
          const picked = e.currentTarget.files?.[0] ?? null;
          setFile(picked);
          setPreview(picked && picked.type.startsWith("image/") ? URL.createObjectURL(picked) : null);
          setError(null);
        }}
        onInvalid={(e) => {
          e.preventDefault(); // our message instead of the browser pop-up
          setError(`Attach the ${label.charAt(0).toLowerCase()}${label.slice(1)}.`);
          if (e.currentTarget.form?.querySelector(":invalid") === e.currentTarget) e.currentTarget.focus();
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-line bg-bg p-2 pr-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-12 w-12 shrink-0 rounded-md border border-line object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line text-xs text-muted">File</span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{file.name}</span>
            <span className="text-xs text-muted">{sizeLabel(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${file.name}`}
            title="Remove"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-muted hover:border-orange hover:text-orange"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}
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
