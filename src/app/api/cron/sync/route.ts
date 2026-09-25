import { revalidatePath } from "next/cache";
import { isAuthorized } from "@/lib/auth";
import { fetchDriveFolders, hasDriveCredentials } from "@/lib/drive";
import { getRedis, loadEvents, overrides, saveToRedis } from "@/lib/store";
import { mirrorEnabled, mirrorVideos } from "@/lib/mirror";
import { mergeEvents } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Hobby-plan maximum

/**
 * Daily Drive check, triggered by Vercel Cron (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; you can call it by hand the same way.
 * Add `?dry=1` to only report what is new.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!getRedis()) return Response.json({ error: "Redis is not configured" }, { status: 500 });

  const [folders, existing] = await Promise.all([fetchDriveFolders(), loadEvents()]);
  const { events, report } = mergeEvents(folders, existing, overrides, hasDriveCredentials() ? "drive" : "public");

  if (new URL(request.url).searchParams.get("dry")) return Response.json({ dryRun: true, report });

  // Save the listing first so new events appear even if the video copy runs long.
  await saveToRedis(events, report);
  if (mirrorEnabled()) {
    const { mirrored, pending } = await mirrorVideos(events, { budgetMs: 3 * 60_000 });
    Object.assign(report, { mirrored, mirrorPending: pending });
    await saveToRedis(events, report);
  }
  revalidatePath("/", "layout");
  return Response.json({ ok: true, report });
}
