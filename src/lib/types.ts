/** Raw shapes, as returned by the Google Drive API (and stored in data/drive-snapshot.json). */
export interface DriveVideo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  /** Name of the category folder the event sits in. */
  category?: string;
  /** Name of the folder inside the category (see fetchDriveFolders); absent for loose files. */
  subcategory?: string;
  createdTime: string;
  modifiedTime: string;
  videos: DriveVideo[];
}

export type MediaKind = "video" | "audio" | "image";
export const kindOf = (v: { kind?: "audio" | "image" }): MediaKind => v.kind ?? "video";

/** What the site renders. One event = one sub-folder of the root Drive folder. */
export interface EventVideo {
  id: string;
  title: string;
  size: number;
  modifiedTime: string;
  /** Set for audio recordings and images; videos leave it out. */
  kind?: "audio" | "image";
  /** Copy on Vercel Blob (optional mirror). When present the site plays it natively. */
  url?: string;
}

export interface EventItem {
  id: string; // Drive folder id
  title: string;
  categories: string[]; // category folder name(s) in Drive; see categories.ts for icons
  subcategory?: string; // folder inside the category, e.g. "סקסופון" in "כלי נגינה"
  date: string; // YYYY-MM-DD (YYYY-01-01 when only the year is known)
  datePrecision: "day" | "year";
  location?: string;
  description?: string;
  videos: EventVideo[];
  addedAt: string; // first time the sync saw this event
  hidden?: boolean;
}

export interface SyncReport {
  at: string;
  source: "drive" | "public" | "snapshot";
  total: number;
  newEvents: { id: string; title: string }[];
  newVideos: { eventId: string; eventTitle: string; title: string }[];
  removedEvents: { id: string; title: string }[];
  removedVideos: { eventId: string; eventTitle: string; title: string }[];
  mirrored?: number;
  mirrorPending?: number;
}

/** Manual corrections per folder id, kept in data/overrides.json. */
export type Overrides = Record<
  string,
  Partial<Pick<EventItem, "title" | "categories" | "date" | "datePrecision" | "location" | "description" | "hidden">>
>;
