"use client";

import { useRef } from "react";

// A thumbnail you click to see the image full size on the same page (✕, Esc or a click outside closes it).

export function ImageViewer({ src, alt, thumbClassName = "" }: { src: string; alt: string; thumbClassName?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Open full size: ${alt}`}
        className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
      >
        {/* Private file behind the role check in /api/files; not optimised by next/image on purpose. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={thumbClassName} />
      </button>
      <dialog
        ref={dialog}
        aria-label={alt}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      >
        <div className="relative flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-[92vh] w-[94vw] rounded-[10px] object-contain" />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            autoFocus
            className="absolute top-3 right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-surface/90 text-ink hover:border-gold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </dialog>
    </>
  );
}
