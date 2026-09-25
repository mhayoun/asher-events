import { fetchDriveFolders, hasDriveCredentials } from "./drive";
import { loadEvents, overrides } from "./store";
import { mergeEvents } from "./sync";
import type { EventItem } from "./types";

/** Cache tag of the Drive listing the pages use; the sync button expires it. */
export const DRIVE_CACHE_TAG = "drive";
const LISTING_TTL = 3600;

export const driveSource = () => (hasDriveCredentials() ? "drive" : "public");

/**
 * What the site shows: the saved events (data/events.json or Redis) merged with the live Drive
 * folder, so a new upload appears without waiting for the daily commit. The Drive listing is
 * cached for an hour; if Drive can't be reached the saved events are shown as they are.
 */
export async function getLiveEvents(): Promise<EventItem[]> {
  const saved = await loadEvents();
  try {
    const folders = await fetchDriveFolders(undefined, { revalidate: LISTING_TTL, tags: [DRIVE_CACHE_TAG] });
    return mergeEvents(folders, saved, overrides, driveSource()).events;
  } catch (err) {
    console.error("Drive unavailable, showing saved events", err);
    return saved;
  }
}

export async function getPublicEvents(): Promise<EventItem[]> {
  return (await getLiveEvents()).filter((e) => !e.hidden);
}
