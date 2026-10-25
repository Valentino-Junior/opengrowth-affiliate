"use client";

import type { ActionState } from "@/lib/errors";
import { Flash, useFlashActionState } from "./flash";
import { CopyValue } from "./copy-value";

type ServerAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action that shows the action's error or success message under it.
 * Messages fade out after a few seconds, except ones with details to copy (e.g. a temporary password).
 * `hidden` adds hidden inputs (e.g. the row id for a table action).
 */
export function ActionForm({
  action,
  hidden,
  children,
  className = "",
  resetOnSuccess = false,
}: {
  action: ServerAction;
  hidden?: Record<string, string>;
  children: React.ReactNode | ((pending: boolean) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useFlashActionState<ActionState>(action, {});
  return (
    <form
      action={formAction}
      className={className}
      // A new key after each successful submit clears the fields.
      key={resetOnSuccess && state.message ? state.nonce : undefined}
    >
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {typeof children === "function" ? children(pending) : children}
      {state.error ? (
        <Flash nonce={state.nonce} tone="error" className="w-full basis-full">
          {state.error}
        </Flash>
      ) : null}
      {state.message ? (
        <Flash nonce={state.nonce} tone="success" persist={!!state.detail} className="w-full basis-full">
          {state.message}
          {state.detail ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 rounded-[10px] border border-line-green bg-surface-green p-3 text-ink">
              {Object.entries(state.detail).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="m-0 -my-0.5 -ml-1.5">
                    <CopyValue value={v} label={k} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Flash>
      ) : null}
    </form>
  );
}
