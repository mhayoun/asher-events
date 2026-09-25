import { getPublicEvents, loadLastSync } from "@/lib/store";

export const revalidate = 3600;

/** Public JSON feed of all events (handy for debugging the sync). */
export async function GET() {
  const [events, lastSync] = await Promise.all([getPublicEvents(), loadLastSync()]);
  return Response.json({ lastSync, events });
}
