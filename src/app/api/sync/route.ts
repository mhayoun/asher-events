import { revalidateTag } from "next/cache";
import { checkSyncPassword } from "@/lib/auth";
import { fetchDriveFolders } from "@/lib/drive";
import { DRIVE_CACHE_TAG, driveSource, getPublicEvents } from "@/lib/events";
import { loadEvents, overrides } from "@/lib/store";
import { mergeEvents } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The "sync now" button on the site. Reads Drive fresh, reports what visitors haven't seen yet,
 * and expires the cached Drive listing so every page shows the new content on the next request.
 * The daily GitHub Action still commits the result to data/ for safekeeping.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!checkSyncPassword(body?.password)) return Response.json({ error: "wrong password" }, { status: 401 });

  const [shown, saved, folders] = await Promise.all([getPublicEvents(), loadEvents(), fetchDriveFolders()]);
  const fresh = mergeEvents(folders, saved, overrides, driveSource()).events.filter((e) => !e.hidden);

  const shownById = new Map(shown.map((e) => [e.id, e]));
  const freshIds = new Set(fresh.map((e) => e.id));
  const newEvents = fresh.filter((e) => !shownById.has(e.id)).map((e) => e.title);
  const newItems = fresh.flatMap((e) => {
    const before = shownById.get(e.id);
    if (!before) return [];
    const known = new Set(before.videos.map((v) => v.id));
    return e.videos.filter((v) => !known.has(v.id)).map((v) => `${e.title} · ${v.title}`);
  });
  const removedEvents = shown.filter((e) => !freshIds.has(e.id)).map((e) => e.title);
  const freshById = new Map(fresh.map((e) => [e.id, e]));
  const removedItems = shown.flatMap((e) => {
    const after = freshById.get(e.id);
    if (!after) return [];
    const still = new Set(after.videos.map((v) => v.id));
    return e.videos.filter((v) => !still.has(v.id)).map((v) => `${e.title} · ${v.title}`);
  });

  revalidateTag(DRIVE_CACHE_TAG, { expire: 0 });
  return Response.json({ ok: true, total: fresh.length, newEvents, newItems, removedEvents, removedItems });
}
