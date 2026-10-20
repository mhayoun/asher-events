import { type EventItem, kindOf, type MediaKind } from "./types";

const dayFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

export function formatEventDate(e: Pick<EventItem, "date" | "datePrecision">): string {
  return e.datePrecision === "year" ? e.date.slice(0, 4) : dayFmt.format(new Date(`${e.date}T12:00:00Z`));
}

export function formatSize(bytes: number): string {
  return bytes ? `${(bytes / 1_048_576).toFixed(bytes > 100 * 1_048_576 ? 0 : 1)} MB` : "";
}

/** "IMG_1234.jpg · 3.2 MB" (the size only when known). */
export const fileLabel = (v: { name?: string; title: string; size: number }) =>
  [v.name ?? v.title, formatSize(v.size)].filter(Boolean).join(" · ");

/** Drive's public thumbnail endpoint. Works when the file is shared "Anyone with the link". */
export const thumbnailUrl = (fileId: string, width = 640) =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

/** Same-origin stream of a Drive file for <video>/<audio> (see app/api/media/[id]/route.ts). */
export const mediaUrl = (fileId: string) => `/api/media/${fileId}`;

export const embedUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/preview`;
export const driveFileUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/view`;
export const driveFolderUrl = (folderId: string) => `https://drive.google.com/drive/folders/${folderId}`;

/** "4 סרטונים", "הקלטה אחת", "2 סרטונים · הקלטה אחת · 3 תמונות" */
export function mediaCount(items: { kind?: "audio" | "image" }[]): string {
  const n = (k: MediaKind) => items.filter((m) => kindOf(m) === k).length;
  const [video, audio, image] = [n("video"), n("audio"), n("image")];
  const parts = [];
  if (video) parts.push(video === 1 ? "סרטון אחד" : `${video} סרטונים`);
  if (audio) parts.push(audio === 1 ? "הקלטה אחת" : `${audio} הקלטות`);
  if (image) parts.push(image === 1 ? "תמונה אחת" : `${image} תמונות`);
  return parts.join(" · ");
}

const NEW_FOR_DAYS = 30;
export function isNew(e: Pick<EventItem, "addedAt">, now = Date.now()): boolean {
  return now - new Date(e.addedAt).getTime() < NEW_FOR_DAYS * 86_400_000;
}
