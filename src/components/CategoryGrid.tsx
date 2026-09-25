import Link from "next/link";
import { orderCategories } from "@/lib/categories";
import { mediaCount } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { Thumbnail } from "./Thumbnail";

/** One card per category folder in Drive; opens the gallery filtered to that category. */
export function CategoryGrid({ events }: { events: EventItem[] }) {
  const byCategory = new Map<string, EventItem[]>();
  for (const e of events) for (const c of e.categories) byCategory.set(c, [...(byCategory.get(c) ?? []), e]);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10" aria-labelledby="categories-title">
      <h2 id="categories-title" className="mb-4 font-display text-3xl font-bold">
        קטגוריות
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {orderCategories(byCategory.keys()).map((c) => {
          const list = [...(byCategory.get(c.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
          const cover = list.flatMap((e) => e.videos).find((v) => v.kind !== "audio");
          return (
            <li key={c.id}>
              <Link
                href={`/?cat=${encodeURIComponent(c.id)}#events`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-gold/60"
              >
                <Thumbnail fileId={cover?.id} emoji={c.emoji} alt="" width={480} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-semibold leading-tight">
                    <span aria-hidden>{c.emoji}</span> {c.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {list.length} {list.length === 1 ? "אירוע" : "אירועים"} · {mediaCount(list.flatMap((e) => e.videos))}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
