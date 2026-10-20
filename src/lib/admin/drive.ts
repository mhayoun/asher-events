// Drive API from the browser, with the signed-in teacher's token (see google.ts).
// Adapted from MyMedia's drive/api.ts.

import { auth } from "./google";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

export const FILE_FIELDS =
  "id,name,mimeType,size,createdTime,modifiedTime,appProperties,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
  imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
}

export class DriveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
  let delay = 1000;
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const token = await auth.getToken();
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
    } catch (e) {
      if (signal?.aborted || attempt >= 5) throw e;
      await sleep((delay *= 2));
      continue;
    }
    if (res.ok) return res;
    if (res.status === 401) {
      auth.invalidate(); // the next getToken() waits for the teacher to reconnect
      continue;
    }
    let message = `Drive error ${res.status}`;
    try {
      message = (await res.json())?.error?.message ?? message;
    } catch {}
    if ((res.status === 429 || res.status >= 500 || res.status === 403) && attempt < 5 && !/permission/i.test(message)) {
      await sleep((delay *= 2) + Math.random() * 500);
      continue;
    }
    throw new DriveError(res.status, message);
  }
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function listChildren(parentId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${parentId}' in parents and trashed = false`,
      fields: `nextPageToken, files(${FILE_FIELDS})`,
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const body = await (await request(`${API}/files?${params}`)).json();
    files.push(...body.files);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

/** True when the signed-in account may add files to this folder. */
export async function canEdit(folderId: string): Promise<boolean> {
  const res = await request(`${API}/files/${folderId}?fields=capabilities(canAddChildren)&supportsAllDrives=true`);
  return Boolean((await res.json()).capabilities?.canAddChildren);
}

export async function createFolder(name: string, parentId: string): Promise<DriveFile> {
  const res = await request(`${API}/files?supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parentId], mimeType: FOLDER_MIME }),
  });
  return res.json();
}

/** The sub-folder with this name, created if missing. */
export async function folderNamed(name: string, parentId: string): Promise<DriveFile> {
  const params = new URLSearchParams({
    q: `'${parentId}' in parents and name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: `files(${FILE_FIELDS})`,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const found = (await (await request(`${API}/files?${params}`)).json()).files?.[0];
  return found ?? createFolder(name, parentId);
}

export async function downloadBlob(id: string, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<Blob> {
  const res = await request(`${API}/files/${id}?alt=media&supportsAllDrives=true`, {}, signal);
  const total = Number(res.headers.get("Content-Length")) || 0;
  if (!res.body || !onProgress || !total) return res.blob();
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onProgress((received += value.length) / total);
  }
  return new Blob(chunks, { type: res.headers.get("Content-Type") ?? undefined });
}

/** Bytes [start, end) of a file. */
export async function downloadRange(id: string, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await request(`${API}/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Range: `bytes=${start}-${end - 1}` } }, signal);
  return new Uint8Array(await res.arrayBuffer());
}

/** PUT with upload progress (fetch cannot report it). */
function putWithProgress(url: string, blob: Blob, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.responseText) : reject(new DriveError(xhr.status, `upload failed ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload failed (network)"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/** Resumable upload: new file (POST) or new content for an existing one (PATCH, same id). */
async function resumable(
  method: "POST" | "PATCH",
  path: string,
  blob: Blob,
  metadata: object & { mimeType?: string },
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<DriveFile> {
  const query = `uploadType=resumable&supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`;
  const init = await request(
    `${UPLOAD}/files${path}?${query}`,
    {
      method,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": metadata.mimeType || blob.type || "application/octet-stream",
        "X-Upload-Content-Length": String(blob.size),
      },
      body: JSON.stringify(metadata),
    },
    signal,
  );
  const location = init.headers.get("Location");
  if (!location) throw new Error("Drive did not return an upload address");
  return JSON.parse(await putWithProgress(location, blob, onProgress, signal));
}

export function createMediaFile(
  blob: Blob,
  metadata: { name: string; parents: string[]; mimeType: string; modifiedTime?: string; appProperties?: Record<string, string> },
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<DriveFile> {
  return resumable("POST", "", blob, metadata, onProgress, signal);
}

/** Replaces a file's content; it keeps its id (and so its place on the site). Drive keeps the old content as a version for 30 days. */
export function uploadNewContent(
  id: string,
  blob: Blob,
  metadata: { name?: string; mimeType?: string; appProperties?: Record<string, string> },
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<DriveFile> {
  return resumable("PATCH", `/${id}`, blob, metadata, onProgress, signal);
}

/** Sets hidden properties on a file without touching its content; modifiedTime is kept so the event's date doesn't move. */
export async function setProperties(id: string, appProperties: Record<string, string>, modifiedTime?: string): Promise<void> {
  await request(`${API}/files/${id}?supportsAllDrives=true&fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties, ...(modifiedTime && { modifiedTime }) }),
  });
}
