// Copy text to the clipboard from a click.
// The modern Clipboard API only exists on secure pages (https://, or localhost). Opened over a plain-http
// network address (e.g. http://192.168.x.x:3000 on a phone) it is missing, so fall back to the older
// select-and-copy command, which works there. Returns false only if both are refused.

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the fallback
  }

  const active = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  // Inside an open pop-up (<dialog>) the rest of the page can't take focus or a selection, so the box goes in the pop-up.
  (active?.closest("dialog[open]") ?? document.body).appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    // execCommand can report success without copying anything if the selection didn't take.
    ok = area.selectionEnd - area.selectionStart === text.length && document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  active?.focus();
  return ok;
}
