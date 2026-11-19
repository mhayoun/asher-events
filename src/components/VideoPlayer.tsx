"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { directMediaUrl, driveFileUrl, embedUrl, fileLabel, formatSize, mediaUrl, thumbnailUrl } from "@/lib/format";
import type { EventVideo } from "@/lib/types";
import { PlayBadge, Thumbnail } from "./Thumbnail";

/**
 * Plays with the browser's own <video>/<audio>. Drive's embedded player needs third-party cookies,
 * which phones block, so it showed a black screen there. Sources, each tried when the previous fails:
 *  1. Blob copy if any, else the Drive API URL directly (no Vercel traffic; needs NEXT_PUBLIC_GOOGLE_API_KEY);
 *  2. the site's own stream (/api/media), which every browser plays but costs Fast Origin Transfer;
 *  3. the Drive player (also for formats the browser can't play, e.g. .3gp).
 */
export function VideoPlayer({ videos, emoji }: { videos: EventVideo[]; emoji: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // how many sources failed per file (see above)
  const [failures, setFailures] = useState<Record<string, number>>({});
  const current = videos.find((v) => v.id === params.get("v")) ?? videos[0];
  if (!current) return <p className="text-muted">אין עדיין סרטונים באירוע הזה.</p>;

  const select = (id: string) => router.replace(`${pathname}?v=${id}`, { scroll: false });
  const direct = current.url ?? directMediaUrl(current.id);
  // No direct URL (no API key): start at the site's stream.
  const failed = failures[current.id] ?? (direct ? 0 : 1);
  const fallBack = () => setFailures((prev) => ({ ...prev, [current.id]: failed + 1 }));
  const src = failed === 0 && direct ? direct : mediaUrl(current.id);
  const native = failed < 2;
  // Nothing goes through the site's stream before someone presses play.
  const preload = failed === 0 ? "metadata" : "none";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div
          className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black shadow-2xl"
        >
          {current.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- Drive renders (and converts, e.g. HEIC) the image
            <img
              key={current.id}
              src={thumbnailUrl(current.id, 1600)}
              alt={current.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : !native ? (
            <iframe
              key={`drive-${current.id}`}
              src={embedUrl(current.id)}
              title={current.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : current.kind === "audio" ? (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,#3b2d52,transparent_70%)] p-6">
              <span className="text-7xl" aria-hidden>
                🎧
              </span>
              <audio key={src} src={src} crossOrigin="anonymous" controls preload={preload} onError={fallBack} className="w-full max-w-lg" />
            </div>
          ) : (
            <video
              key={src}
              src={src}
              crossOrigin="anonymous"
              poster={thumbnailUrl(current.id, 1280)}
              controls
              playsInline
              preload={preload}
              onError={fallBack}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{current.title}</h2>
            <p className="mt-0.5 truncate text-sm text-muted" dir="auto">
              {fileLabel(current)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
            {native && current.kind !== "image" && (
              <button onClick={fallBack} className="text-muted hover:text-gold">
                לא מתנגן? נגן חלופי
              </button>
            )}
            <a href={driveFileUrl(current.id)} target="_blank" rel="noreferrer" className="text-gold hover:underline">
              פתיחה ב-Google Drive ↗
            </a>
          </div>
        </div>
      </div>

      <ol className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto" aria-label="רשימת סרטונים">
        {videos.map((v, i) => {
          const active = v.id === current.id;
          return (
            <li key={v.id}>
              <button
                onClick={() => select(v.id)}
                aria-current={active}
                className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-right transition ${
                  active ? "border-gold bg-gold-soft" : "border-line bg-surface hover:border-gold/60"
                }`}
              >
                <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <Thumbnail
                    fileId={v.kind === "audio" ? undefined : v.id}
                    emoji={v.kind === "audio" ? "🎧" : emoji}
                    alt=""
                    width={240}
                    video={!v.kind}
                  />
                  {!v.kind && <PlayBadge size="sm" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted">{[i + 1, formatSize(v.size)].filter(Boolean).join(" · ")}</span>
                  <span className="line-clamp-2 break-all font-medium" dir="auto">
                    {v.name ?? v.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
