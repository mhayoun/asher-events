/**
 * Checks the Google Drive folder for new events/videos and publishes them.
 *
 *   npm run sync                 # Drive -> Redis (if configured) + data/events.json
 *   npm run sync -- --dry-run    # only report what is new, change nothing
 *   npm run sync -- --snapshot   # rebuild from data/drive-snapshot.json (no Google credentials needed)
 *
 * Reads .env.local (see .env.example).
 */
import { readFileSync, writeFileSync } from "node:fs";
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
    if (!hasDriveCredentials()) {
      console.error("No Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_API_KEY in .env.local, or use --snapshot.");
      process.exit(1);
    }
    console.log(`Reading Drive folder ${ROOT_FOLDER_ID} ...`);
    folders = await fetchDriveFolders();
  }

  const existing: EventItem[] = getRedis()
    ? await loadEvents()
    : JSON.parse(readFileSync(join(DATA, "events.json"), "utf8"));
  const { events, report } = mergeEvents(folders, existing, overrides, useSnapshot ? "snapshot" : "drive");

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

  writeFileSync(join(DATA, "events.json"), JSON.stringify(events, null, 1) + "\n");
  if (!useSnapshot)
    writeFileSync(
      join(DATA, "drive-snapshot.json"),
      JSON.stringify({ rootFolderId: ROOT_FOLDER_ID, capturedAt: report.at, folders }, null, 1) + "\n",
    );
  console.log("\nSaved data/events.json");

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
    console.log("Redis not configured - commit data/events.json to publish.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
