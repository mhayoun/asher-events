"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  SKIP_LABEL,
  canCompressVideo,
  compressPhoto,
  compressVideo,
  compressedProps,
  kindOf,
  NO_GAIN_PROP,
  outputName,
  planDriveFile,
  planLocalFile,
  worthIt,
  type Skip,
} from "@/lib/admin/compress";
import {
  createMediaFile,
  downloadBlob,
  FOLDER_MIME,
  folderNamed,
  listChildren,
  setProperties,
  uploadNewContent,
  type DriveFile,
} from "@/lib/admin/drive";
import { auth, type AuthState } from "@/lib/admin/google";

// Same folder as the server (src/lib/drive.ts); public, it is in the site's links anyway.
const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_DRIVE_ROOT_FOLDER_ID || "1z1LJJCZUkLvmkj-Rg001URbcc7Om9-sU";
const NEW_CATEGORY = "__new__";

type Tab = "upload" | "compress" | "sync";
type Row = { key: string; name: string; status: string; progress?: number; error?: boolean };

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;

function useAuth(): AuthState {
  return useSyncExternalStore(
    (fn) => auth.subscribe(fn),
    () => auth.state,
    () => auth.state,
  );
}

/**
 * Footer entry for the teacher: sign in with the Google account that owns the Drive "events"
 * folder, then create an event with its media (compressed on the way, like MyMedia), compress
 * files that were put in Drive directly, and update the site at once.
 */
export function AdminPanel() {
  const state = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("upload");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    auth.init().catch((e) => console.error(e));
  }, []);

  // Leaving the page would stop the uploads/compressions halfway.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  if (state.status === "signedOut")
    return (
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => auth.signIn(true)} className={pill}>
          <GoogleIcon /> כניסת מנהל
        </button>
        {state.error === "scope_denied" && <p className="text-xs text-red-400">יש לאשר גישה לדרייב כדי לנהל את האירועים</p>}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(true)} className={pill}>
          ⚙ ניהול האירועים
        </button>
        <button onClick={() => auth.signOut()} disabled={busy} className="text-xs text-muted underline hover:text-gold disabled:opacity-50">
          יציאה
        </button>
      </div>
      {state.status === "expired" && (
        <button onClick={() => auth.signIn()} className="text-xs text-gold underline">
          החיבור לגוגל פג - לחצו להתחברות מחדש
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-label="ניהול האירועים"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-surface text-right shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-fg">ניהול האירועים</h2>
                <p className="truncate text-xs text-muted">{state.email}</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="סגירה" className="text-xl text-muted hover:text-gold disabled:opacity-40">
                ✕
              </button>
            </div>
            <div className="flex gap-1 border-b border-line px-2 pt-2 text-sm">
              {(
                [
                  ["upload", "אירוע חדש"],
                  ["compress", "דחיסת קבצים בדרייב"],
                  ["sync", "עדכון מהדרייב"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  disabled={busy}
                  className={`rounded-t-lg px-3 py-2 disabled:opacity-50 ${tab === id ? "border-b-2 border-gold text-gold" : "text-muted hover:text-fg"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-4">
              {tab === "upload" && <UploadEvent busy={busy} setBusy={setBusy} />}
              {tab === "compress" && <CompressDrive busy={busy} setBusy={setBusy} />}
              {tab === "sync" && <SyncSite busy={busy} setBusy={setBusy} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Busy = { busy: boolean; setBusy: (b: boolean) => void };

type SyncResult = { newEvents: string[]; newItems: string[]; removedEvents: string[]; removedItems: string[] };

/** Re-reads Drive on the server and refreshes the site; returns lines for the teacher. */
async function updateSite(): Promise<string[]> {
  const res = await fetch("/api/sync", { method: "POST", headers: { Authorization: `Bearer ${await auth.getToken()}` } });
  if (res.status === 401) throw new Error("לחשבון הזה אין הרשאת עריכה בתיקיית האירועים בדרייב");
  if (!res.ok) throw new Error("העדכון נכשל, נסו שוב בעוד רגע");
  const r: SyncResult = await res.json();
  const lines = [
    ...r.newEvents.map((t) => `אירוע חדש: ${t}`),
    ...r.newItems.map((t) => `קטע חדש: ${t}`),
    ...r.removedEvents.map((t) => `אירוע הוסר: ${t}`),
    ...r.removedItems.map((t) => `קטע הוסר: ${t}`),
  ];
  return lines.length ? [...lines, "האתר עודכן ✓"] : ["אין חדש בדרייב - האתר מעודכן ✓"];
}

function SyncSite({ busy, setBusy }: Busy) {
  const router = useRouter();
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState(false);

  async function run() {
    setBusy(true);
    setLines([]);
    try {
      setLines(await updateSite());
      setError(false);
      router.refresh();
    } catch (e) {
      setError(true);
      setLines([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted">בדיקה אם נוספו אירועים או קטעים בתיקיית הדרייב, ועדכון האתר מיד.</p>
      <button onClick={run} disabled={busy} className={primary}>
        {busy ? "בודק…" : "בדיקה ועדכון"}
      </button>
      <Lines lines={lines} error={error} />
    </div>
  );
}

function UploadEvent({ busy, setBusy }: Busy) {
  const router = useRouter();
  const [categories, setCategories] = useState<DriveFile[] | null>(null);
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [videoHere, setVideoHere] = useState(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    canCompressVideo().then(setVideoHere);
    listChildren(ROOT_FOLDER_ID)
      .then((all) => {
        const folders = all.filter((f) => f.mimeType === FOLDER_MIME);
        setCategories(folders);
        setCategory((c) => c || folders[0]?.id || NEW_CATEGORY);
      })
      .catch(() => {
        setCategories([]);
        setCategory(NEW_CATEGORY);
        setError(true);
        setLines(["לא ניתן לקרוא את תיקיית האירועים בדרייב עם החשבון הזה"]);
      });
  }, []);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    const catName = newCategory.trim();
    if (!name || !files.length || (category === NEW_CATEGORY && !catName)) return;
    const total = files.reduce((n, f) => n + f.size, 0);
    auth.renewBefore(Math.max(10 * 60_000, (total / 1_048_576) * 2000)); // ~2 s per MB, at least 10 minutes
    setBusy(true);
    setError(false);
    setLines([]);
    const list = files.map((f, i) => ({ key: `${i}-${f.name}`, file: f }));
    setRows(list.map(({ key, file }) => ({ key, name: file.name, status: "ממתין" })));
    const controller = (abort.current = new AbortController());
    const signal = controller.signal;
    let before = 0;
    let after = 0;
    let failed = 0;
    try {
      const parent = category === NEW_CATEGORY ? (await folderNamed(catName, ROOT_FOLDER_ID)).id : category;
      // An existing event of the same name gets the new files added to it.
      const event = await folderNamed(name, parent);
      for (const { key, file } of list) {
        if (signal.aborted) break;
        try {
          const kind = kindOf(file.type, file.name);
          const skip = await planLocalFile(file);
          let blob: Blob = file;
          let meta = { name: file.name, mimeType: file.type || "application/octet-stream" };
          let compressed = false;
          if (!skip) {
            update(key, { status: "דוחס…", progress: 0 });
            try {
              const out = kind === "video" ? await compressVideo(file, (p) => update(key, { progress: p }), signal) : await compressPhoto(file);
              if (worthIt(file.size, out.size)) {
                blob = out;
                meta = outputName(file.name, kind);
                compressed = true;
              }
            } catch (err) {
              if (signal.aborted) throw err;
              console.warn("compression failed, uploading the original", file.name, err);
            }
          }
          update(key, { status: "מעלה…", progress: 0 });
          await createMediaFile(
            blob,
            {
              ...meta,
              parents: [event.id],
              // The site dates events from their files: keep the date the media was made.
              modifiedTime: new Date(file.lastModified || Date.now()).toISOString(),
              ...(compressed && { appProperties: compressedProps(file.size) }),
            },
            (p) => update(key, { progress: p }),
            signal,
          );
          before += file.size;
          after += blob.size;
          update(key, {
            status: compressed ? `✓ ${mb(file.size)} → ${mb(blob.size)}` : `✓ ${mb(file.size)}${skip ? ` (${SKIP_LABEL[skip]})` : ""}`,
            progress: undefined,
          });
        } catch (err) {
          if (signal.aborted) break;
          failed++;
          console.error(err);
          update(key, { status: "שגיאה", error: true, progress: undefined });
        }
      }
      if (signal.aborted) {
        setError(true);
        setLines(["ההעלאה הופסקה. הקבצים שכבר עלו נשארים בדרייב."]);
        return;
      }
      const result = [`הועלו ${list.length - failed} קבצים: ${mb(before)} → ${mb(after)}`];
      if (failed) result.push(`${failed} קבצים נכשלו - אפשר להעלות אותם שוב לאותו אירוע`);
      setLines([...result, ...(await updateSite())]);
      setError(failed > 0);
      setFiles([]);
      router.refresh();
    } catch (err) {
      setError(true);
      setLines([err instanceof Error ? err.message : String(err)]);
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className={labelCls}>קטגוריה</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy || !categories} className={input}>
          {!categories && <option>טוען…</option>}
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY}>קטגוריה חדשה…</option>
        </select>
      </label>
      {category === NEW_CATEGORY && (
        <label className="block">
          <span className={labelCls}>שם הקטגוריה החדשה</span>
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required disabled={busy} className={input} />
        </label>
      )}
      <label className="block">
        <span className={labelCls}>שם האירוע</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={busy}
          placeholder="למשל: בר מצוה של יוסי 2025"
          className={input}
        />
        <span className="mt-1 block text-xs text-muted">שנה בשם האירוע קובעת את התאריך שלו באתר; אחרת התאריך נלקח מהקבצים.</span>
      </label>
      <label className="block">
        <span className={labelCls}>קבצים (סרטונים, תמונות, הקלטות)</span>
        <input
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          disabled={busy}
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
          className="block w-full text-sm text-muted file:ml-3 file:rounded-full file:border file:border-line file:bg-bg file:px-3 file:py-1.5 file:text-fg"
        />
        {files.length > 0 && (
          <span className="mt-1 block text-xs text-muted">
            {files.length} קבצים · {mb(files.reduce((n, f) => n + f.size, 0))}
          </span>
        )}
      </label>
      {!videoHere && (
        <p className="rounded-xl border border-line bg-bg p-2 text-xs text-muted">
          מהטלפון התמונות נדחסות אבל הסרטונים עולים כמו שהם. אפשר לדחוס אותם אחר כך ממחשב, בלשונית &quot;דחיסת קבצים בדרייב&quot;.
        </p>
      )}
      {busy ? (
        <button type="button" onClick={() => abort.current?.abort()} className={secondary}>
          עצירה
        </button>
      ) : (
        <button type="submit" disabled={!categories} className={primary}>
          דחיסה, העלאה ועדכון האתר
        </button>
      )}
      {busy && <p className="text-xs text-muted">נא להשאיר את הדף פתוח עד הסוף.</p>}
      <Rows rows={rows} />
      <Lines lines={lines} error={error} />
    </form>
  );
}

type Candidate = { file: DriveFile; path: string; skip: Skip | null };

/** Every media file below the root, with the folder path it sits in ("category / event"). */
async function walk(folderId: string, path: string[], out: { file: DriveFile; path: string }[], onFolder: (n: number) => void) {
  const children = await listChildren(folderId);
  onFolder(1);
  for (const f of children) {
    if (f.mimeType === FOLDER_MIME) await walk(f.id, [...path, f.name], out, onFolder);
    else if (path.length) out.push({ file: f, path: path.join(" / ") });
  }
}

function CompressDrive({ busy, setBusy }: Busy) {
  const router = useRouter();
  const [scan, setScan] = useState<string>("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function find() {
    setBusy(true);
    setLines([]);
    setRows([]);
    setCandidates(null);
    try {
      const files: { file: DriveFile; path: string }[] = [];
      let folders = 0;
      await walk(ROOT_FOLDER_ID, [], files, (n) => setScan(`סורק תיקיות… ${(folders += n)}`));
      const media = files.filter(({ file }) => ["photo", "video"].includes(kindOf(file.mimeType, file.name)));
      const planned: Candidate[] = [];
      for (const [i, m] of media.entries()) {
        setScan(`בודק קבצים… ${i + 1}/${media.length}`);
        planned.push({ ...m, skip: await planDriveFile(m.file) });
      }
      const todo = planned.filter((c) => !c.skip);
      setCandidates(planned);
      setSelected(new Set(todo.map((c) => c.file.id)));
      const waitingForComputer = planned.filter((c) => c.skip === "videoNotHere").length;
      setLines([
        todo.length ? `${todo.length} קבצים לדחיסה (${mb(todo.reduce((n, c) => n + Number(c.file.size ?? 0), 0))})` : "אין קבצים לדחיסה ✓",
        ...(waitingForComputer ? [`${waitingForComputer} סרטונים ממתינים לדחיסה ממחשב`] : []),
      ]);
      setError(false);
    } catch (e) {
      setError(true);
      setLines([e instanceof Error ? e.message : String(e)]);
    } finally {
      setScan("");
      setBusy(false);
    }
  }

  async function compress() {
    const todo = (candidates ?? []).filter((c) => !c.skip && selected.has(c.file.id));
    if (!todo.length) return;
    const total = todo.reduce((n, c) => n + Number(c.file.size ?? 0), 0);
    auth.renewBefore(Math.max(10 * 60_000, (total / 1_048_576) * 3000));
    setBusy(true);
    setLines([]);
    setRows(todo.map((c) => ({ key: c.file.id, name: `${c.path} / ${c.file.name}`, status: "ממתין" })));
    const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const controller = (abort.current = new AbortController());
    const signal = controller.signal;
    let saved = 0;
    let count = 0;
    let failed = 0;
    try {
      for (const { file } of todo) {
        if (signal.aborted) break;
        const size = Number(file.size ?? 0);
        const kind = kindOf(file.mimeType, file.name);
        try {
          update(file.id, { status: "דוחס…", progress: 0 });
          const out =
            kind === "video"
              ? await compressVideo({ id: file.id, size }, (p) => update(file.id, { progress: p }), signal)
              : await compressPhoto(await downloadBlob(file.id, (p) => update(file.id, { progress: p }), signal));
          if (!worthIt(size, out.size)) {
            await setProperties(file.id, { [NO_GAIN_PROP]: "1" }, file.modifiedTime);
            update(file.id, { status: "נשאר כמו שהוא (חיסכון קטן)", progress: undefined });
            continue;
          }
          update(file.id, { status: "מעלה…", progress: 0 });
          // Same file id: the video keeps its place on the site; Drive keeps the original as a version for 30 days.
          await uploadNewContent(
            file.id,
            out,
            { ...outputName(file.name, kind), appProperties: compressedProps(size), ...(file.modifiedTime && { modifiedTime: file.modifiedTime }) },
            (p) => update(file.id, { progress: p }),
            signal,
          );
          saved += size - out.size;
          count++;
          update(file.id, { status: `✓ ${mb(size)} → ${mb(out.size)}`, progress: undefined });
        } catch (err) {
          if (signal.aborted) break;
          failed++;
          console.error(err);
          const reason = err instanceof Error ? err.message : String(err);
          update(file.id, { status: `שגיאה - הקובץ נשאר כמו שהוא (${reason})`, error: true, progress: undefined });
        }
      }
      const result = [`${count} קבצים נדחסו, נחסכו ${mb(saved)}`];
      if (signal.aborted) result.push("הדחיסה הופסקה.");
      if (failed) result.push(`${failed} קבצים לא נדחסו`);
      if (count) result.push(...(await updateSite()));
      setLines(result);
      setError(failed > 0);
      setCandidates(null);
      router.refresh();
    } catch (e) {
      setError(true);
      setLines([e instanceof Error ? e.message : String(e)]);
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }

  const todo = candidates?.filter((c) => !c.skip) ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        קבצים שהועלו ישר לדרייב נשארים בגודל המקורי. כאן מוצאים את הגדולים ודוחסים אותם במקום (720p לסרטונים). המקור נשמר בדרייב
        כגרסה קודמת למשך 30 יום.
      </p>
      {!rows.length || !busy ? (
        <div className="flex gap-2">
          <button onClick={find} disabled={busy} className={candidates && todo.length ? secondary : primary}>
            {scan || "חיפוש קבצים לדחיסה"}
          </button>
          {candidates && todo.length > 0 && (
            <button onClick={compress} disabled={busy || !selected.size} className={primary}>
              דחיסת {selected.size} קבצים
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => abort.current?.abort()} className={secondary}>
          עצירה
        </button>
      )}
      {busy && rows.length > 0 && <p className="text-xs text-muted">נא להשאיר את הדף פתוח עד הסוף.</p>}
      <Lines lines={lines} error={error} />
      {candidates && todo.length > 0 && !busy && (
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-2 text-sm">
          {todo.map(({ file, path }) => (
            <li key={file.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={(e) =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(file.id);
                      else n.delete(file.id);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted">{path} / </span>
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted" dir="ltr">
                  {mb(Number(file.size ?? 0))}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <Rows rows={rows} />
    </div>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2 text-sm">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <span className="min-w-0 truncate">{r.name}</span>
            <span className={`text-xs ${r.error ? "break-all text-red-400" : "shrink-0 text-muted"}`}>
              {r.status}
              {r.progress !== undefined && ` ${Math.round(r.progress * 100)}%`}
            </span>
          </div>
          {r.progress !== undefined && (
            <div className="mt-1 h-1 overflow-hidden rounded bg-line">
              <div className="h-full bg-gold transition-[width]" style={{ width: `${r.progress * 100}%` }} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Lines({ lines, error }: { lines: string[]; error: boolean }) {
  if (!lines.length) return null;
  return (
    <ul role="status" className={`space-y-1 text-sm ${error ? "text-red-400" : "text-fg"}`}>
      {lines.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-4 w-4">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const pill =
  "flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-gold hover:text-gold";
const primary = "w-full rounded-xl bg-gold py-2 font-semibold text-bg transition hover:brightness-110 disabled:opacity-60";
const secondary = "w-full rounded-xl border border-line py-2 text-fg transition hover:border-gold disabled:opacity-60";
const labelCls = "mb-1 block text-xs text-muted";
const input = "w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-gold disabled:opacity-60";
