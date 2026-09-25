/** True when the request carries `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends exactly this). */
export function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
