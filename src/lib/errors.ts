/** A business-rule violation the person can fix. Its message is safe to show on the form. */
export class RuleError extends Error {}

export type ActionState = { error?: string; message?: string; detail?: Record<string, string> };

/** Runs a mutation from a server action and turns rule violations into a message on the form. */
export async function attempt(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message };
    throw e;
  }
}
