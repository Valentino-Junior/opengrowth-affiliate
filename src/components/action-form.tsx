"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/errors";

type ServerAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action that shows the action's error or success message under it.
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
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className={className}
      // A new key after each successful submit clears the fields.
      key={resetOnSuccess && state.message ? state.message + (state.detail ? JSON.stringify(state.detail) : "") : undefined}
    >
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {typeof children === "function" ? children(pending) : children}
      {state.error ? (
        <p role="alert" className="m-0 w-full basis-full text-sm text-orange">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <div role="status" className="m-0 w-full basis-full text-sm text-green">
          {state.message}
          {state.detail ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-[10px] border border-line-green bg-surface-green p-3 text-ink">
              {Object.entries(state.detail).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="m-0 font-mono font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
