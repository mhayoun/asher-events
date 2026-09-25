import Link from "next/link";
import { orderCategories } from "@/lib/categories";
import type { EventItem } from "@/lib/types";

/** One tile per category folder in Drive (icon + name); opens the gallery filtered to that category. */
export function CategoryGrid({ events }: { events: EventItem[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10" aria-labelledby="categories-title">
      <h2 id="categories-title" className="mb-4 font-display text-3xl font-bold">
        קטגוריות
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {orderCategories(events.flatMap((e) => e.categories)).map((c) => (
          <li key={c.id}>
            <Link
              href={`/?cat=${encodeURIComponent(c.id)}#events`}
              className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-3 py-5 text-center transition hover:-translate-y-0.5 hover:border-gold/60 hover:bg-surface-2"
            >
              <span className="text-4xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="font-semibold leading-tight">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
