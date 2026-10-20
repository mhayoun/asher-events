"use client";

import { useEffect, useRef, useState } from "react";
import { mediaUrl, thumbnailUrl } from "@/lib/format";

/**
 * Drive thumbnail over a decorative placeholder. The placeholder stays visible while the image loads
 * and when it can't load at all (file not shared publicly yet / no preview generated). A video without
 * a Drive preview (recent or very large files) shows a frame of the video itself instead.
 */
export function Thumbnail({
  fileId,
  emoji,
  alt,
  width = 640,
  video = false,
}: {
  fileId?: string;
  emoji: string;
  alt: string;
  width?: number;
  video?: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(fileId ? "loading" : "failed");
  const [frame, setFrame] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // The image may finish before hydration, in which case onLoad/onError never fire.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? "loaded" : "failed");
  }, []);
  return (
    <>
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#3b2d52,transparent_60%),linear-gradient(135deg,#221c2d,#15111c)]">
        <span className="text-4xl opacity-80" aria-hidden>
          {video ? "🎬" : emoji}
        </span>
      </div>
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Drive thumbnails, can't be optimized reliably
        <img
          ref={img}
          src={thumbnailUrl(fileId!, width)}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {state === "failed" && video && fileId && (
        <video
          src={`${mediaUrl(fileId)}#t=1`}
          preload="metadata"
          muted
          playsInline
          aria-label={alt}
          onLoadedData={() => setFrame(true)}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            frame ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </>
  );
}

/** Round play button drawn over a video's thumbnail. */
export function PlayBadge({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={`absolute inset-0 m-auto grid place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/40 transition group-hover:bg-gold group-hover:text-bg ${
        size === "sm" ? "h-7 w-7 text-xs" : "h-14 w-14 text-2xl"
      }`}
    >
      <span className="translate-x-px">▶</span>
    </span>
  );
}
