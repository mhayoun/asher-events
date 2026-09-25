import { fetchDriveMedia } from "@/lib/drive";
import { getPublicEvents } from "@/lib/events";

export const maxDuration = 60;

// Vercel Functions can't return more than 4.5 MB per response, so every answer is a partial one
// (206) of at most this size; <video>/<audio> then ask for the next range by themselves.
const CHUNK = 4 * 1024 * 1024;

/**
 * Serves a Drive video/recording from the site's own domain. Phones (iPhone Safari especially)
 * showed a black screen with Drive's embedded player and refuse Drive's direct links cross-site;
 * a same-origin stream with range support plays everywhere.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  // Only files that belong to an event on the site - this is not an open Drive proxy.
  const item = (await getPublicEvents()).flatMap((e) => e.videos).find((v) => v.id === id);
  if (!item) return new Response("Not found", { status: 404 });

  const m = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  const start = m?.[1] ? Number(m[1]) : 0;
  const askedEnd = m?.[2] ? Number(m[2]) : Infinity;
  const end = Math.min(askedEnd, start + CHUNK - 1);

  let upstream: Response;
  try {
    upstream = await fetchDriveMedia(id, `bytes=${start}-${end}`);
  } catch (err) {
    console.error(err);
    return new Response("Media unavailable", { status: 502 });
  }
  if (upstream.status === 416) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${item.size || "*"}` } });

  const type = upstream.headers.get("content-type") ?? "";
  const headers = new Headers({
    "Content-Type": type && type !== "application/octet-stream" ? type : item.kind === "audio" ? "audio/mpeg" : "video/mp4",
    "Accept-Ranges": "bytes",
    // Browser-only cache: a shared cache must not mix up different byte ranges of the same URL.
    "Cache-Control": "private, max-age=86400",
    Vary: "Range",
  });
  for (const h of ["content-range", "content-length"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Drive answers 200 with the whole file when the range covers all of it; keep that as-is.
  return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}
