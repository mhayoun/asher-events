import { createHash, timingSafeEqual } from "node:crypto";

/** True when the request carries `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends exactly this). */
export function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Checks the password of the site's sync button (SYNC_PASSWORD) without leaking timing. */
export function checkSyncPassword(password: unknown): boolean {
  const expected = process.env.SYNC_PASSWORD;
  if (!expected || typeof password !== "string") return false;
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
