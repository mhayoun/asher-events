"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PASSWORD_KEY = "sync-password";

type Result = { newEvents: string[]; newItems: string[]; removedEvents: string[] };

function readSaved(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}

function save(password: string | null) {
  try {
    if (password) localStorage.setItem(PASSWORD_KEY, password);
    else localStorage.removeItem(PASSWORD_KEY);
  } catch {}
}

/** Header button for the teacher: checks Drive now and refreshes the site. Password-protected. */
export function SyncButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string[]>([]);

  function toggle() {
    if (!open && !password) setPassword(readSaved());
    setOpen(!open);
  }

  async function sync(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setMessage([]);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 401) {
        save(null);
        setStatus("error");
        return setMessage(["סיסמה שגויה"]);
      }
      if (!res.ok) throw new Error(String(res.status));
      save(password);
      const r: Result = await res.json();
      const lines = [
        ...r.newEvents.map((t) => `אירוע חדש: ${t}`),
        ...r.newItems.map((t) => `קטע חדש: ${t}`),
        ...r.removedEvents.map((t) => `הוסר: ${t}`),
      ];
      setStatus("done");
      setMessage(lines.length ? [...lines, "האתר עודכן ✓"] : ["אין חדש בדרייב - האתר מעודכן ✓"]);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage(["העדכון נכשל, נסו שוב בעוד רגע"]);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-gold hover:text-gold"
      >
        <span aria-hidden className={status === "busy" ? "inline-block animate-spin" : ""}>
          ⟳
        </span>
        עדכון מהדרייב
      </button>

      {open && (
        <form
          onSubmit={sync}
          className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-2xl"
        >
          <p className="text-sm text-muted">בדיקה אם נוספו אירועים או קטעים בתיקיית הדרייב, ועדכון האתר מיד.</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-muted">סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-gold"
            />
          </label>
          <button
            type="submit"
            disabled={status === "busy"}
            className="mt-3 w-full rounded-xl bg-gold py-2 font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
          >
            {status === "busy" ? "בודק…" : "בדיקה ועדכון"}
          </button>
          {message.length > 0 && (
            <ul
              role="status"
              className={`mt-3 space-y-1 text-sm ${status === "error" ? "text-red-400" : "text-fg"}`}
            >
              {message.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </form>
      )}
    </div>
  );
}
