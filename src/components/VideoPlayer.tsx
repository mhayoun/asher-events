"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driveFileUrl, embedUrl, thumbnailUrl } from "@/lib/format";
import type { EventVideo } from "@/lib/types";
import { Thumbnail } from "./Thumbnail";

function formatSize(bytes: number) {
  return bytes ? `${(bytes / 1_048_576).toFixed(bytes > 100 * 1_048_576 ? 0 : 1)} MB` : "";
}

export function VideoPlayer({ videos, emoji }: { videos: EventVideo[]; emoji: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = videos.find((v) => v.id === params.get("v")) ?? videos[0];
  if (!current) return <p className="text-muted">אין עדיין סרטונים באירוע הזה.</p>;

  const select = (id: string) => router.replace(`${pathname}?v=${id}`, { scroll: false });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black shadow-2xl">
          {current.url ? (
            <video
              key={current.id}
              src={current.url}
              poster={thumbnailUrl(current.id, 1280)}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <iframe
              key={current.id}
              src={embedUrl(current.id)}
              title={current.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{current.title}</h2>
          <a href={driveFileUrl(current.id)} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-gold hover:underline">
            פתיחה ב-Google Drive ↗
          </a>
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
                  <Thumbnail fileId={v.id} emoji={emoji} alt="" width={240} />
                  {active && <span className="absolute inset-0 grid place-items-center bg-black/50 text-gold">▶</span>}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted">
                    {i + 1} · {formatSize(v.size)}
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
