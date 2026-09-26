import { JWT } from "google-auth-library";
import { MEDIA_EXT_RE } from "./categories";
import type { DriveFolder, DriveVideo } from "./types";

const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || "1z1LJJCZUkLvmkj-Rg001URbcc7Om9-sU";

/**
 * How folder listings are fetched. By default always fresh; the site passes a Next.js cache
 * setting ({ revalidate, tags }) so pages reuse the listing and the sync button can expire it by tag.
 */
export type ListingCache = { revalidate: number; tags: string[] } | undefined;
const fetchOptions = (cache: ListingCache): RequestInit => (cache ? { next: cache } : { cache: "no-store" });

export function hasDriveCredentials(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_API_KEY);
}

const VIDEO_EXT = /\.(mp4|m4v|mov|avi|mkv|webm|3gp|mpg|mpeg|wmv)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav|aac|ogg|oga|flac|wma)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;

export const isMediaMime = (mime: string) => /^(video|audio|image)\//.test(mime);

/** "10/8/25" (US format used by the public view) → ISO. Times ("10:30 AM") mean today. */
function parsePublicDate(text: string): string {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) {
    // A time of day means "modified today"; keep it at day precision so repeated syncs produce the same output.
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)).toISOString();
  }
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2]), 12)).toISOString();
}

const decodeHtml = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Lists a folder shared "Anyone with the link" without any Google credentials,
 * using Drive's public embedded folder view. No sizes; dates are day-precision.
 */
async function listPublicChildren(folderId: string, cache: ListingCache) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, fetchOptions(cache));
  if (!res.ok) throw new Error(`Drive folder ${folderId} is not public (${res.status})`);
  const html = await res.text();
  const entries = html.split('class="flip-entry"').slice(1);
  return entries.map((chunk) => {
    const id = chunk.match(/id="entry-([^"]+)"/)?.[1] ?? "";
    const isFolder = /href="[^"]*\/folders\//.test(chunk);
    const isVideo = /alt="Video"/.test(chunk);
    const isAudio = /alt="Audio"/.test(chunk);
    const isImage = /alt="Image"/.test(chunk);
    const name = decodeHtml(chunk.match(/flip-entry-title">([^<]*)/)?.[1]?.trim() ?? "");
    const modified = parsePublicDate(chunk.match(/flip-entry-last-modified"><div>([^<]*)/)?.[1] ?? "");
    return {
      id,
      name,
      mimeType: isFolder
        ? FOLDER_MIME
        : isVideo || VIDEO_EXT.test(name)
          ? "video/mp4"
          : isAudio || AUDIO_EXT.test(name)
            ? "audio/mpeg"
            : isImage || IMAGE_EXT.test(name)
              ? "image/jpeg"
              : "application/octet-stream",
      createdTime: modified,
      modifiedTime: modified,
    };
  });
}

/**
 * Without credentials the folder is read through its public view (it must be shared "Anyone with the link").
 * With credentials the official Drive API is used (exact timestamps and sizes, private folders work):
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

async function listChildren(parentId: string, auth: Awaited<ReturnType<typeof authParams>>, cache: ListingCache) {
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
    const res = await fetch(`${API}?${params}`, { headers: auth.headers, ...fetchOptions(cache) });
    if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
    const body = await res.json();
    files.push(...body.files);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

/**
 * Streams a file's bytes from Drive, optionally only a byte range ("bytes=0-1023").
 * Used by the site's media route and to mirror media to Vercel Blob.
 */
export async function fetchDriveMedia(fileId: string, range?: string): Promise<Response> {
  const rangeHeader: Record<string, string> = range ? { Range: range } : {};
  if (!hasDriveCredentials()) {
    const res = await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`, {
      headers: rangeHeader,
      cache: "no-store",
    });
    if (!res.ok || !res.body || res.headers.get("content-type")?.includes("text/html"))
      throw new Error(`Public download ${fileId} failed: ${res.status}`);
    return res;
  }
  const auth = await authParams();
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  if (auth.key) params.set("key", auth.key);
  const res = await fetch(`${API}/${fileId}?${params}`, { headers: { ...auth.headers, ...rangeHeader }, cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`Drive download ${fileId} failed: ${res.status}`);
  return res;
}

/**
 * The Drive folder is organised as  root / category / event / media files:
 *   - every folder directly under the root is a category (its name is shown on the site);
 *   - every folder inside a category is an event; its media, including media in deeper
 *     sub-folders, are the event's items (kept in `videos` for historical reasons);
 *   - a media file placed directly in a category folder is an event of its own, named after the file.
 * Files placed directly in the root are ignored.
 */
export async function fetchDriveFolders(rootId = ROOT_FOLDER_ID, cache?: ListingCache): Promise<DriveFolder[]> {
  const auth = hasDriveCredentials() ? await authParams() : null;
  const list = (id: string) => (auth ? listChildren(id, auth, cache) : listPublicChildren(id, cache));
  const isFolder = (f: { mimeType: string }) => f.mimeType === FOLDER_MIME;

  async function collectVideos(folderId: string): Promise<DriveVideo[]> {
    const children = await list(folderId);
    const nested = await Promise.all(children.filter(isFolder).map((f) => collectVideos(f.id)));
    return [...children.filter((f) => isMediaMime(f.mimeType)), ...nested.flat()];
  }

  const categories = (await list(rootId)).filter(isFolder);
  const perCategory = await Promise.all(
    categories.map(async (cat) => {
      const children = await list(cat.id);
      const events: DriveFolder[] = await Promise.all(
        children.filter(isFolder).map(async (f) => ({
          id: f.id,
          name: f.name,
          category: cat.name,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          videos: await collectVideos(f.id),
        })),
      );
      for (const f of children.filter((c) => isMediaMime(c.mimeType)))
        events.push({
          id: f.id,
          name: f.name.replace(MEDIA_EXT_RE, "").replace(/_/g, " ").trim(),
          category: cat.name,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          videos: [f],
        });
      return events;
    }),
  );
  return perCategory.flat();
}
