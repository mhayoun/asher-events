import { classify } from "./categories";
import type { DriveFolder, EventItem, EventVideo, Overrides, SyncReport } from "./types";

const YEAR_RE = /(?<!\d)(19[89]\d|20\d\d)(?!\d)/g;

function years(text: string): number[] {
  return [...text.matchAll(YEAR_RE)].map((m) => Number(m[1]));
}

export function cleanVideoTitle(name: string): string {
  return name
    .replace(/\.(mp4|m4v|mov|avi|mkv|webm|mp3|m4a|wav|aac|ogg|flac)/gi, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best guess for the event date:
 *  1. a year written in the folder name (then in the video names) wins;
 *  2. if the earliest video timestamp falls in that year we keep the full day;
 *  3. otherwise fall back to the earliest video timestamp / folder creation time.
 * Anything wrong can be fixed in data/overrides.json.
 */
function inferDate(folder: DriveFolder): Pick<EventItem, "date" | "datePrecision"> {
  const stamps = folder.videos.map((v) => v.modifiedTime).sort();
  const earliest = (stamps[0] ?? folder.createdTime).slice(0, 10);
  const titleYears = years(folder.name);
  const videoYears = folder.videos.flatMap((v) => years(v.name));
  const year = titleYears.length ? Math.max(...titleYears) : videoYears.length ? Math.max(...videoYears) : null;
  if (year === null) return { date: earliest, datePrecision: "day" };
  if (earliest.startsWith(String(year))) return { date: earliest, datePrecision: "day" };
  return { date: `${year}-01-01`, datePrecision: "year" };
}

export function buildEvent(folder: DriveFolder, override: Overrides[string] = {}): Omit<EventItem, "addedAt"> {
  const videos: EventVideo[] = folder.videos
    .map((v) => ({
      id: v.id,
      title: cleanVideoTitle(v.name),
      size: Number(v.size ?? 0),
      modifiedTime: v.modifiedTime,
      ...(v.mimeType.startsWith("audio/") && { kind: "audio" as const }),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "he", { numeric: true }));

  return {
    id: folder.id,
    title: folder.name.trim(),
    categories: classify(folder.name, folder.videos.map((v) => v.name)),
    ...inferDate(folder),
    videos,
    ...override,
  };
}

/** Merges a fresh Drive listing into the stored events and reports what changed. */
export function mergeEvents(
  folders: DriveFolder[],
  existing: EventItem[],
  overrides: Overrides,
  source: SyncReport["source"],
  now = new Date().toISOString(),
): { events: EventItem[]; report: SyncReport } {
  const previous = new Map(existing.map((e) => [e.id, e]));
  // The public view has no sizes and only day-precision dates: keep what we already know about each video.
  if (source === "public") {
    const known = new Map(existing.flatMap((e) => e.videos).map((v) => [v.id, v]));
    for (const f of folders)
      for (const v of f.videos) {
        const prev = known.get(v.id);
        if (prev) Object.assign(v, { size: String(prev.size), modifiedTime: prev.modifiedTime });
      }
  }
  const firstRun = existing.length === 0;
  const report: SyncReport = { at: now, source, total: 0, newEvents: [], newVideos: [], removedEvents: [] };

  const events = folders
    .filter((f) => f.videos.length > 0) // empty folders are events still being uploaded
    .map((folder) => {
      const built = buildEvent(folder, overrides[folder.id]);
      const prev = previous.get(folder.id);
      // keep Blob copies made by earlier runs
      const mirrored = new Map(prev?.videos.filter((v) => v.url).map((v) => [v.id, v.url]));
      for (const v of built.videos) if (mirrored.has(v.id)) v.url = mirrored.get(v.id);
      if (!prev) {
        if (!firstRun) report.newEvents.push({ id: built.id, title: built.title });
      } else {
        const known = new Set(prev.videos.map((v) => v.id));
        for (const v of built.videos)
          if (!known.has(v.id)) report.newVideos.push({ eventId: built.id, eventTitle: built.title, title: v.title });
      }
      return { ...built, addedAt: prev?.addedAt ?? (firstRun ? folder.createdTime : now) };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const current = new Set(events.map((e) => e.id));
  report.removedEvents = existing.filter((e) => !current.has(e.id)).map((e) => ({ id: e.id, title: e.title }));
  report.total = events.length;
  return { events, report };
}
