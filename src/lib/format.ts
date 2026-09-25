import type { EventItem } from "./types";

const dayFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

export function formatEventDate(e: Pick<EventItem, "date" | "datePrecision">): string {
  return e.datePrecision === "year" ? e.date.slice(0, 4) : dayFmt.format(new Date(`${e.date}T12:00:00Z`));
}

/** Drive's public thumbnail endpoint. Works when the file is shared "Anyone with the link". */
export const thumbnailUrl = (fileId: string, width = 640) =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

export const embedUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/preview`;
export const driveFileUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/view`;
export const driveFolderUrl = (folderId: string) => `https://drive.google.com/drive/folders/${folderId}`;

const NEW_FOR_DAYS = 30;
export function isNew(e: Pick<EventItem, "addedAt">, now = Date.now()): boolean {
  return now - new Date(e.addedAt).getTime() < NEW_FOR_DAYS * 86_400_000;
}
