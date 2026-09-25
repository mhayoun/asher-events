import { JWT } from "google-auth-library";
import type { DriveFolder, DriveVideo } from "./types";

const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || "1z1LJJCZUkLvmkj-Rg001URbcc7Om9-sU";

export function hasDriveCredentials(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_API_KEY);
}

/**
 * Two ways to authenticate:
 *  - GOOGLE_SERVICE_ACCOUNT_JSON: a service-account key (raw JSON or base64). Share the Drive folder
 *    with the service account's email as Viewer. Works even when the folder is private.
 *  - GOOGLE_API_KEY: plain API key. Only works when the folder is shared "Anyone with the link".
 */
async function authParams(): Promise<{ headers: Record<string, string>; key?: string }> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const json = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    const client = new JWT({
      email: json.client_email,
      key: json.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const { token } = await client.getAccessToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  if (process.env.GOOGLE_API_KEY) return { headers: {}, key: process.env.GOOGLE_API_KEY };
  throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_API_KEY");
}

async function listChildren(parentId: string, auth: Awaited<ReturnType<typeof authParams>>) {
  const files: (DriveVideo & { mimeType: string })[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    if (auth.key) params.set("key", auth.key);
    const res = await fetch(`${API}?${params}`, { headers: auth.headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
    const body = await res.json();
    files.push(...body.files);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

/** Streams a file's bytes from Drive (used to mirror videos to Vercel Blob). */
export async function fetchDriveMedia(fileId: string): Promise<Response> {
  const auth = await authParams();
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  if (auth.key) params.set("key", auth.key);
  const res = await fetch(`${API}/${fileId}?${params}`, { headers: auth.headers, cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`Drive download ${fileId} failed: ${res.status}`);
  return res;
}

/**
 * Every direct sub-folder of the root is an event. Videos inside nested sub-folders
 * are flattened into their top-level event.
 */
export async function fetchDriveFolders(rootId = ROOT_FOLDER_ID): Promise<DriveFolder[]> {
  const auth = await authParams();
  const top = (await listChildren(rootId, auth)).filter((f) => f.mimeType === FOLDER_MIME);

  async function collectVideos(folderId: string): Promise<DriveVideo[]> {
    const children = await listChildren(folderId, auth);
    const videos = children.filter((f) => f.mimeType.startsWith("video/"));
    const nested = await Promise.all(children.filter((f) => f.mimeType === FOLDER_MIME).map((f) => collectVideos(f.id)));
    return [...videos, ...nested.flat()];
  }

  return Promise.all(
    top.map(async (f) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      videos: await collectVideos(f.id),
    })),
  );
}
