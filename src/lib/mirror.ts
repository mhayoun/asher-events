import { put } from "@vercel/blob";
import { fetchDriveMedia } from "./drive";
import type { EventItem } from "./types";

export const mirrorEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN) && process.env.MIRROR_TO_BLOB !== "0";

/**
 * Copies videos that are not yet on Vercel Blob. Mutates `events` in place (sets video.url).
 * Stops starting new uploads once `budgetMs` is spent, so a cron run never times out;
 * the rest is picked up on the next run.
 */
export async function mirrorVideos(
  events: EventItem[],
  { budgetMs = Infinity, log = console.log }: { budgetMs?: number; log?: (msg: string) => void } = {},
): Promise<{ mirrored: number; pending: number }> {
  const started = Date.now();
  // images are shown through Drive thumbnails, only videos/recordings are copied
  const todo = events.flatMap((e) => e.videos.filter((v) => !v.url && v.kind !== "image").map((v) => ({ e, v })));
  let mirrored = 0;
  for (const { e, v } of todo) {
    if (Date.now() - started > budgetMs) break;
    log(`  uploading "${v.title}" (${e.title}) ${(v.size / 1_048_576).toFixed(0)} MB ...`);
    try {
      const media = await fetchDriveMedia(v.id);
      const blob = await put(`videos/${e.id}/${v.id}.${v.kind === "audio" ? "mp3" : "mp4"}`, media.body!, {
        access: "public",
        contentType: media.headers.get("content-type") ?? (v.kind === "audio" ? "audio/mpeg" : "video/mp4"),
        multipart: true,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      v.url = blob.url;
      mirrored++;
    } catch (err) {
      // leave it for the next run; the site falls back to the Drive player meanwhile
      log(`  failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { mirrored, pending: todo.length - mirrored };
}
