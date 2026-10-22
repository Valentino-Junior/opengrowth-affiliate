"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";

// The bell in the top bar: unread count, and a list that takes you to where each thing needs attention.
// It refreshes on every page change, when the tab comes back into view, and every 30 seconds.

type Item = { id: string; title: string; body: string | null; href: string; read: boolean; createdAt: string };

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: Item[] }>({ unread: 0, items: [] });
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // offline for a moment: keep what we have
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && void load();
    const timer = setInterval(onFocus, 30_000);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = async (item: Item) => {
    setOpen(false);
    if (!item.read) {
      setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)) }));
      await markNotificationReadAction(item.id);
    }
    router.push(item.href);
  };

  const readAll = async () => {
    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, read: true })) }));
    await markAllNotificationsReadAction();
  };

  const count = data.unread > 99 ? "99+" : String(data.unread);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-line bg-transparent text-ink hover:border-gold"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.unread ? (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 text-[11px] font-extrabold text-white"
          >
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-full right-0 z-50 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-2xl shadow-black/60"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-extrabold">Notifications</span>
            {data.unread ? (
              <button type="button" onClick={readAll} className="cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-gold hover:underline">
                Mark all as read
              </button>
            ) : null}
          </div>
          <ul className="m-0 max-h-[60vh] list-none overflow-y-auto p-0">
            {data.items.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</li> : null}
            {data.items.map((n) => (
              <li key={n.id} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={`flex w-full cursor-pointer gap-3 border-0 px-4 py-3 text-left hover:bg-white/5 ${n.read ? "bg-transparent" : "bg-gold/5"}`}
                >
                  <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-gold"}`} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`text-sm ${n.read ? "text-ink-soft" : "font-bold text-ink"}`}>
                      {n.title}
                      {n.read ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {n.body ? <span className="text-xs text-muted">{n.body}</span> : null}
                    <span className="text-[11px] text-muted">{ago(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
