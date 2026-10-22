// Normalising contact details so "unique across all affiliates and players" actually holds.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** US-centric E.164: "(555) 010-2030" → "+15550102030". Numbers already starting with + are kept as digits. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/** "$Player07", "@player07 " → "player07" so the same handle typed two ways still matches. */
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^[$@]/, "");
}
