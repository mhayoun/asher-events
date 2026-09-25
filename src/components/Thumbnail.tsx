"use client";

import { useState } from "react";
import { thumbnailUrl } from "@/lib/format";

/**
 * Drive thumbnail over a decorative placeholder. The placeholder stays visible while the image loads
 * and when it can't load at all (file not shared publicly yet / no preview generated).
 */
export function Thumbnail({ fileId, emoji, alt, width = 640 }: { fileId?: string; emoji: string; alt: string; width?: number }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(fileId ? "loading" : "failed");
  return (
    <>
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#3b2d52,transparent_60%),linear-gradient(135deg,#221c2d,#15111c)]">
        <span className="text-4xl opacity-80" aria-hidden>
          {emoji}
        </span>
      </div>
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Drive thumbnails, can't be optimized reliably
        <img
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
    </>
  );
}
