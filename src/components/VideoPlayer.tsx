"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { driveFileUrl, embedUrl, mediaUrl, thumbnailUrl } from "@/lib/format";
import type { EventVideo } from "@/lib/types";
import { Thumbnail } from "./Thumbnail";

function formatSize(bytes: number) {
  return bytes ? `${(bytes / 1_048_576).toFixed(bytes > 100 * 1_048_576 ? 0 : 1)} MB` : "";
}

/**
 * Plays with the browser's own <video>/<audio>, streamed through the site (or from Blob). Drive's
 * embedded player needs third-party cookies, which phones block, so it showed a black screen there.
 * Formats the browser can't play (e.g. .3gp) fall back to the Drive player automatically.
 */
export function VideoPlayer({ videos, emoji }: { videos: EventVideo[]; emoji: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [useDrivePlayer, setUseDrivePlayer] = useState<Set<string>>(new Set());
  const current = videos.find((v) => v.id === params.get("v")) ?? videos[0];
  if (!current) return <p className="text-muted">אין עדיין סרטונים באירוע הזה.</p>;

  const select = (id: string) => router.replace(`${pathname}?v=${id}`, { scroll: false });
  const fallBack = () => setUseDrivePlayer((prev) => new Set(prev).add(current.id));
  const src = current.url ?? mediaUrl(current.id);
  const native = !useDrivePlayer.has(current.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black shadow-2xl">
          {!native ? (
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
              <audio key={current.id} src={src} controls preload="metadata" onError={fallBack} className="w-full max-w-lg" />
            </div>
          ) : (
            <video
              key={current.id}
              src={src}
              poster={thumbnailUrl(current.id, 1280)}
              controls
              playsInline
              preload="metadata"
              onError={fallBack}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{current.title}</h2>
          <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
            {native && (
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
                  <Thumbnail fileId={v.kind === "audio" ? undefined : v.id} emoji={v.kind === "audio" ? "🎧" : emoji} alt="" width={240} />
                  {active && <span className="absolute inset-0 grid place-items-center bg-black/50 text-gold">▶</span>}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted">
                    {[i + 1, formatSize(v.size)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="line-clamp-2 font-medium">{v.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
