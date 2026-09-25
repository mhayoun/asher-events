"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { categoryInfo, normalize, OTHER, orderCategories } from "@/lib/categories";
import { formatEventDate, isNew, mediaCount } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { Thumbnail } from "./Thumbnail";

type Filters = { q: string; cats: string[]; from: string; to: string; sort: "new" | "old" };

function eventRange(e: EventItem): [string, string] {
  return e.datePrecision === "year" ? [`${e.date.slice(0, 4)}-01-01`, `${e.date.slice(0, 4)}-12-31`] : [e.date, e.date];
}

function searchText(e: EventItem): string {
  return normalize(
    [e.title, e.location, e.description, ...e.videos.map((v) => v.title), ...e.categories.map((c) => categoryInfo(c).label)]
      .filter(Boolean)
      .join(" "),
  );
}

export function EventExplorer({ events }: { events: EventItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The text box keeps its own state so typing stays smooth; the URL follows after a short pause.
  const [q, setQ] = useState(params.get("q") ?? "");
  const f: Filters = {
    q,
    cats: params.get("cat")?.split(",").filter(Boolean) ?? [],
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: params.get("sort") === "old" ? "old" : "new",
  };

  function update(next: Partial<Filters>) {
    const merged = { ...f, ...next };
    const sp = new URLSearchParams();
    if (merged.q) sp.set("q", merged.q);
    if (merged.cats.length) sp.set("cat", merged.cats.join(","));
    if (merged.from) sp.set("from", merged.from);
    if (merged.to) sp.set("to", merged.to);
    if (merged.sort === "old") sp.set("sort", "old");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const urlQ = params.get("q") ?? "";
  useEffect(() => {
    if (q === urlQ) return;
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the text should trigger this
  }, [q]);

  const indexed = useMemo(() => events.map((e) => ({ e, text: searchText(e) })), [events]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) for (const id of e.categories) c[id] = (c[id] ?? 0) + 1;
    return c;
  }, [events]);
  const years = useMemo(() => [...new Set(events.map((e) => e.date.slice(0, 4)))].sort().reverse(), [events]);

  const results = useMemo(() => {
    const terms = normalize(f.q).split(" ").filter(Boolean);
    return indexed
      .filter(({ e, text }) => {
        if (terms.length && !terms.every((t) => text.includes(t))) return false;
        if (f.cats.length && !f.cats.some((c) => e.categories.includes(c))) return false;
        const [start, end] = eventRange(e);
        if (f.from && end < f.from) return false;
        if (f.to && start > f.to) return false;
        return true;
      })
      .map(({ e }) => e)
      .sort((a, b) => (f.sort === "new" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [indexed, f.q, f.cats, f.from, f.to, f.sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of results) map.set(e.date.slice(0, 4), [...(map.get(e.date.slice(0, 4)) ?? []), e]);
    return [...map.entries()];
  }, [results]);

  const activeYear = f.from.endsWith("-01-01") && f.to === `${f.from.slice(0, 4)}-12-31` ? f.from.slice(0, 4) : "";
  const hasFilters = Boolean(f.q || f.cats.length || f.from || f.to);
  // One category at a time: picking another replaces the current one, picking it again clears it.
  const toggleCat = (id: string) => update({ cats: f.cats.includes(id) ? [] : [id] });

  return (
    <section id="events" className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-16 pt-6">
      {/* Search & date filters */}
      <div className="z-20 -mx-4 md:sticky md:top-[61px] border-b border-line bg-bg/95 px-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-muted">חיפוש בכותרת או בשם שיר</span>
            <input
              type="search"
              value={f.q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="לדוגמה: ברית, קזבלנקה, גבעת זאב..."
              className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 outline-none placeholder:text-muted/60 focus:border-gold"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <label>
              <span className="mb-1 block text-xs text-muted">מתאריך</span>
              <input
                type="date"
                value={f.from}
                max={f.to || undefined}
                onChange={(e) => update({ from: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-gold"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">עד תאריך</span>
              <input
                type="date"
                value={f.to}
                min={f.from || undefined}
                onChange={(e) => update({ to: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-gold"
              />
            </label>
          </div>
          <label>
            <span className="mb-1 block text-xs text-muted">מיון</span>
            <select
              value={f.sort}
              onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-gold"
            >
              <option value="new">מהחדש לישן</option>
              <option value="old">מהישן לחדש</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">שנה:</span>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => (activeYear === y ? update({ from: "", to: "" }) : update({ from: `${y}-01-01`, to: `${y}-12-31` }))}
              className={`rounded-full border px-3 py-1 transition ${activeYear === y ? "border-gold bg-gold text-bg" : "border-line hover:border-gold"}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="קטגוריות">
        {orderCategories(Object.keys(counts)).map((c) => {
          const on = f.cats.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleCat(c.id)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
                on ? "border-gold bg-gold-soft text-gold" : "border-line bg-surface hover:border-gold/60"
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
              <span className="text-xs text-muted">{counts[c.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-muted">
        <span>
          נמצאו {results.length} אירועים · {mediaCount(results.flatMap((e) => e.videos))}
        </span>
        {hasFilters && (
          <button onClick={() => {
              setQ("");
              update({ q: "", cats: [], from: "", to: "" });
            }} className="text-gold hover:underline">
            ניקוי סינון ✕
          </button>
        )}
      </div>

      {/* Timeline grouped by year */}
      {grouped.length === 0 ? (
        <p className="py-20 text-center text-muted">לא נמצאו אירועים. נסו מילה אחרת או טווח תאריכים רחב יותר.</p>
      ) : (
        grouped.map(([year, list]) => (
          <div key={year} className="mt-8">
            <h2 className="mb-4 flex items-center gap-3 font-display text-3xl font-bold text-gold">
              {year}
              <span className="h-px flex-1 bg-line" />
              <span className="font-sans text-sm font-normal text-muted">{list.length} אירועים</span>
            </h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function EventCard({ event: e }: { event: EventItem }) {
  const main = categoryInfo(e.categories[0] ?? OTHER);
  return (
    <Link
      href={`/events/${e.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[0_10px_40px_-10px_#e3b45a40]"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        <Thumbnail fileId={e.videos.find((v) => v.kind !== "audio")?.id} emoji={main.emoji} alt={e.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
        <span className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-gold/90 text-2xl text-bg opacity-0 transition group-hover:opacity-100">
          ▶
        </span>
        <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs">
          {mediaCount(e.videos)}
        </span>
        {isNew(e) && <span className="absolute top-2 right-2 rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-bg">חדש</span>}
      </div>
      <div className="p-4">
        <p className="text-xs text-muted">{formatEventDate(e)}</p>
        <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug">{e.title}</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {e.categories.map((c) => (
            <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {categoryInfo(c).emoji} {categoryInfo(c).label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
