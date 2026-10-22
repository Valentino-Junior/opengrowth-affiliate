"use client";

import { useActionState, useCallback, useState } from "react";

// Form-level messages ("Email or password is wrong.", "Saved.") that show for a few seconds and then fade out.
// Every submission gets a new `nonce`, so the same message shows again on the next try.

export type Flashable = { nonce?: number };

/** useActionState that stamps each result with a fresh nonce, so <Flash> can restart for every submission. */
export function useFlashActionState<S extends object>(action: (prev: S, form: FormData) => Promise<S>, initial: S) {
  const stamped = useCallback(
    async (prev: S & Flashable, form: FormData): Promise<S & Flashable> => ({ ...(await action(prev, form)), nonce: Date.now() + Math.random() }),
    [action],
  );
  return useActionState<S & Flashable, FormData>(stamped, initial as Awaited<S & Flashable>);
}

const tones = { error: "text-orange", success: "text-green" };

export function Flash({
  nonce,
  tone,
  persist = false,
  className = "",
  children,
}: {
  nonce: number | undefined;
  tone: keyof typeof tones;
  /** Keep it on screen (e.g. a temporary password the person must copy). */
  persist?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [hiddenFor, setHiddenFor] = useState<number>();
  if (nonce === undefined || hiddenFor === nonce) return null;
  return (
    <div
      key={nonce}
      role={tone === "error" ? "alert" : "status"}
      className={`m-0 text-sm ${tones[tone]} ${persist ? "" : "flash-out"} ${className}`}
      onAnimationEnd={() => setHiddenFor(nonce)}
    >
      {children}
    </div>
  );
}
