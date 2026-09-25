/**
 * Checks the Google Drive folder for new events/videos and publishes them.
 *
 *   npm run sync                 # Drive -> data/events.json (+ Redis if configured)
 *   npm run sync:publish         # same, then commit & push data/ so Vercel redeploys
 *   npm run sync -- --dry-run    # only report what is new, change nothing
 *   npm run sync -- --snapshot   # rebuild from data/drive-snapshot.json (no Google credentials needed)
 *
 * Reads .env.local (see .env.example).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchDriveFolders, hasDriveCredentials, ROOT_FOLDER_ID } from "../src/lib/drive";
import { mirrorEnabled, mirrorVideos } from "../src/lib/mirror";
import { mergeEvents } from "../src/lib/sync";
import { getRedis, loadEvents, overrides, saveToRedis } from "../src/lib/store";
import type { DriveFolder, EventItem } from "../src/lib/types";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const useSnapshot = args.has("--snapshot");
const DATA = join(__dirname, "..", "data");

async function main() {
  let folders: DriveFolder[];
  if (useSnapshot) {
    folders = JSON.parse(readFileSync(join(DATA, "drive-snapshot.json"), "utf8")).folders;
  } else {
    console.log(`Reading Drive folder ${ROOT_FOLDER_ID} (${hasDriveCredentials() ? "Drive API" : "public link"}) ...`);
    folders = await fetchDriveFolders();
  }

  const existing: EventItem[] = getRedis()
    ? await loadEvents()
    : JSON.parse(readFileSync(join(DATA, "events.json"), "utf8"));
  const { events, report } = mergeEvents(folders, existing, overrides, useSnapshot ? "snapshot" : hasDriveCredentials() ? "drive" : "public");

  console.log(`\n${report.total} events, ${events.reduce((n, e) => n + e.videos.length, 0)} videos`);
  for (const e of report.newEvents) console.log(`  + new event: ${e.title}`);
  for (const v of report.newVideos) console.log(`  + new video in "${v.eventTitle}": ${v.title}`);
  for (const e of report.removedEvents) console.log(`  - removed: ${e.title}`);
  if (!report.newEvents.length && !report.newVideos.length && !report.removedEvents.length) console.log("  nothing new");

  if (dryRun) return console.log("\n(dry run, nothing saved)");

  if (mirrorEnabled() && !useSnapshot) {
    console.log("\nCopying videos to Vercel Blob ...");
    const { mirrored, pending } = await mirrorVideos(events);
    Object.assign(report, { mirrored, mirrorPending: pending });
    console.log(`  ${mirrored} uploaded`);
  }

  // Only touch files whose content changed, so the daily GitHub Action commits (and redeploys) only when needed.
  const changed = [writeIfChanged("events.json", events)];
  if (!useSnapshot) {
    const sorted = [...folders].sort((a, b) => a.id.localeCompare(b.id));
    changed.push(writeIfChanged("drive-snapshot.json", { rootFolderId: ROOT_FOLDER_ID, folders: sorted }));
  }
  console.log(changed.some(Boolean) ? "\nUpdated data/" : "\ndata/ unchanged");

  if (await saveToRedis(events, report)) {
    console.log("Saved to Redis");
    const site = process.env.SITE_URL;
    if (site && process.env.CRON_SECRET) {
      const res = await fetch(`${site.replace(/\/$/, "")}/api/revalidate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      console.log(`Revalidated ${site}: ${res.status}`);
    }
  } else {
    console.log("Redis not configured - commit and push data/ to publish (npm run sync:publish does it).");
  }
}

function writeIfChanged(file: string, value: unknown): boolean {
  const path = join(DATA, file);
  const next = JSON.stringify(value, null, 1) + "\n";
  if (existsSync(path) && readFileSync(path, "utf8") === next) return false;
  writeFileSync(path, next);
  return true;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
