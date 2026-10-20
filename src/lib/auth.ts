import { ROOT_FOLDER_ID } from "./drive";

/** True when the request carries `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends exactly this). */
export function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * True when the request carries the Google token of an account that can add files to the events
 * folder in Drive (the teacher, signed in on the site). Google itself checks the token.
 */
export async function isDriveEditor(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${ROOT_FOLDER_ID}?fields=capabilities(canAddChildren)&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  return res.ok && Boolean((await res.json()).capabilities?.canAddChildren);
}
