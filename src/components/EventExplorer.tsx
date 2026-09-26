"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { categoryInfo, normalize, OTHER, orderCategories } from "@/lib/categories";
import { formatEventDate, isNew, mediaCount } from "@/lib/format";
import { tagCloud, titleWords } from "@/lib/tags";
import { type EventItem, kindOf, type MediaKind } from "@/lib/types";
import { Thumbnail } from "./Thumbnail";

type TypeFilter = MediaKind | "all";
type Filters = { q: string; type: TypeFilter; cat: string; sub: string; tags: string[]; from: string; to: string };

const TYPES: { id: TypeFilter; label: string; emoji: string }[] = [
  { id: "all", label: "הכל", emoji: "✨" },
  { id: "video", label: "וידאו", emoji: "🎬" },
  { id: "audio", label: "אודיו", emoji: "🎧" },
  { id: "image", label: "תמונות", emoji: "🖼️" },
];
const isType = (t: string | null): t is MediaKind => t === "video" || t === "audio" || t === "image";

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

/** A framed filter row with its title. */
function FilterBox({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted">{title}</p>
      <div className="flex flex-wrap items-baseline gap-2" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition disabled:cursor-default disabled:opacity-40 ${
    on ? "border-gold bg-gold-soft text-gold" : "border-line bg-surface hover:border-gold/60"
  }`;

/**
 * Search, then narrow down step by step: media type → category → sub-category → words of the titles.
 * Each row only offers what is left after the rows above it. Results are newest first.
 */
export function EventExplorer({ events }: { events: EventItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The text box keeps its own state so typing stays smooth; the URL follows after a short pause.
  const [q, setQ] = useState(params.get("q") ?? "");
  const typeParam = params.get("type");
  const f: Filters = {
    q,
    type: isType(typeParam) ? typeParam : "all",
    cat: params.get("cat") ?? "",
    sub: params.get("sub") ?? "",
    tags: params.get("tags")?.split(",").filter(Boolean) ?? [],
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };

  function update(next: Partial<Filters>) {
    const merged = { ...f, ...next };
    const sp = new URLSearchParams();
    if (merged.q) sp.set("q", merged.q);
    if (merged.type !== "all") sp.set("type", merged.type);
    if (merged.cat) sp.set("cat", merged.cat);
    if (merged.cat && merged.sub) sp.set("sub", merged.sub);
    if (merged.tags.length) sp.set("tags", merged.tags.join(","));
    if (merged.from) sp.set("from", merged.from);
    if (merged.to) sp.set("to", merged.to);
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

  const indexed = useMemo(
    () => events.map((e) => ({ e, text: searchText(e), words: new Set(titleWords(e).keys()) })),
    [events],
  );

  // Step 1: text and dates.
  const searched = useMemo(() => {
    const terms = normalize(f.q).split(" ").filter(Boolean);
    return indexed.filter(({ e, text }) => {
      if (terms.length && !terms.every((t) => text.includes(t))) return false;
      const [start, end] = eventRange(e);
      if (f.from && end < f.from) return false;
      if (f.to && start > f.to) return false;
      return true;
    });
  }, [indexed, f.q, f.from, f.to]);

  // Step 2: media type (events holding at least one item of that type).
  const typeCounts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: 0, video: 0, audio: 0, image: 0 };
    for (const { e } of searched)
      for (const v of e.videos) {
        c[kindOf(v)]++;
        c.all++;
      }
    return c;
  }, [searched]);
  const typed = useMemo(
    () => (f.type === "all" ? searched : searched.filter(({ e }) => e.videos.some((v) => kindOf(v) === f.type))),
    [searched, f.type],
  );

  // Step 3: category.
  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { e } of typed) for (const id of e.categories) c[id] = (c[id] ?? 0) + 1;
    return c;
  }, [typed]);
  const inCategory = useMemo(() => (f.cat ? typed.filter(({ e }) => e.categories.includes(f.cat)) : typed), [typed, f.cat]);

  // Step 4: sub-category (only once a category is chosen).
  const subCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { e } of inCategory) if (e.subcategory) c[e.subcategory] = (c[e.subcategory] ?? 0) + 1;
    return c;
  }, [inCategory]);
  const inSub = useMemo(
    () => (f.cat && f.sub ? inCategory.filter(({ e }) => e.subcategory === f.sub) : inCategory),
    [inCategory, f.cat, f.sub],
  );

  // Step 5: title words - every selected word must appear.
  const results = useMemo(
    () =>
      inSub
        .filter(({ words }) => f.tags.every((t) => words.has(t)))
        .map(({ e }) => e)
        .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "he")),
    [inSub, f.tags],
  );
  const tags = useMemo(() => {
    const cloud = tagCloud(results);
    const shown = new Set(cloud.map((t) => t.id));
    // keep selected words visible (and removable) even when they no longer narrow anything
    const selected = f.tags
      .filter((id) => !shown.has(id))
      .map((id) => ({ id, label: indexed.flatMap(({ e }) => [...titleWords(e)]).find(([k]) => k === id)?.[1] ?? id, count: results.length }));
    return [...selected, ...cloud];
  }, [results, f.tags, indexed]);
  const [minCount, maxCount] = tags.length ? [Math.min(...tags.map((t) => t.count)), Math.max(...tags.map((t) => t.count))] : [1, 1];

  const hasFilters = Boolean(f.q || f.type !== "all" || f.cat || f.tags.length || f.from || f.to);
  const pickCategory = (id: string) => update({ cat: f.cat === id ? "" : id, sub: "", tags: [] });
  const pickSub = (id: string) => update({ sub: id, tags: [] });
  const subs = Object.keys(subCounts).sort((a, b) => a.localeCompare(b, "he"));
  const toggleTag = (id: string) => update({ tags: f.tags.includes(id) ? f.tags.filter((t) => t !== id) : [...f.tags, id] });

  return (
    <section id="events" className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-16 pt-6">
      {/* Text & dates */}
      <div className="z-20 -mx-4 border-b border-line bg-bg/95 px-4 py-4 md:sticky md:top-[61px]">
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
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <FilterBox title="סוג" label="סוג מדיה">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ type: t.id })}
              aria-pressed={f.type === t.id}
              disabled={t.id !== "all" && !typeCounts[t.id]}
              className={chip(f.type === t.id)}
            >
              <span aria-hidden>{t.emoji}</span>
              {t.label}
              <span className="text-xs text-muted">{typeCounts[t.id]}</span>
            </button>
          ))}
        </FilterBox>

        <FilterBox title="קטגוריה" label="קטגוריות">
          {orderCategories([...Object.keys(catCounts), ...(f.cat ? [f.cat] : [])]).map((c) => (
            <button key={c.id} onClick={() => pickCategory(c.id)} aria-pressed={f.cat === c.id} className={chip(f.cat === c.id)}>
              <span aria-hidden>{c.emoji}</span>
              {c.label}
              <span className="text-xs text-muted">{catCounts[c.id] ?? 0}</span>
            </button>
          ))}
        </FilterBox>

        {f.cat && subs.length > 0 && (
          <FilterBox title={`תת-קטגוריה ב${categoryInfo(f.cat).label}`} label="תת-קטגוריות">
            <button onClick={() => pickSub("")} aria-pressed={!f.sub} className={chip(!f.sub)}>
              הכל
              <span className="text-xs text-muted">{inCategory.length}</span>
            </button>
            {subs.map((id) => (
              <button key={id} onClick={() => pickSub(id)} aria-pressed={f.sub === id} className={chip(f.sub === id)}>
                {id}
                <span className="text-xs text-muted">{subCounts[id]}</span>
              </button>
            ))}
          </FilterBox>
        )}

        {tags.length > 0 && (
          <FilterBox
            title={`מילים מהכותרות${f.sub ? ` ב${f.sub}` : f.cat ? ` ב${categoryInfo(f.cat).label}` : ""} · אפשר לבחור כמה`}
            label="מילים"
          >
            {tags.map((t) => {
              const on = f.tags.includes(t.id);
              const weight = maxCount === minCount ? 0.5 : (t.count - minCount) / (maxCount - minCount);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  aria-pressed={on}
                  title={`${t.count} אירועים`}
                  style={{ fontSize: `${0.8 + weight * 0.7}rem`, opacity: on ? 1 : 0.55 + weight * 0.45 }}
                  className={`rounded-lg px-1.5 leading-tight transition hover:text-gold ${
                    on ? "bg-gold-soft font-semibold text-gold ring-1 ring-gold" : ""
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </FilterBox>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-muted">
        <span>
          נמצאו {results.length} אירועים · {mediaCount(results.flatMap((e) => e.videos))}
        </span>
        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              update({ q: "", type: "all", cat: "", sub: "", tags: [], from: "", to: "" });
            }}
            className="text-gold hover:underline"
          >
            ניקוי סינון ✕
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="py-20 text-center text-muted">לא נמצאו אירועים. נסו מילה אחרת או טווח תאריכים רחב יותר.</p>
      ) : (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((e) => (
            <li key={e.id}>
              <EventCard event={e} type={f.type} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const KIND_ICON = { video: "🎬", audio: "🎧", image: "🖼️" } as const;
const FILES_SHOWN = 3;

function EventCard({ event: e, type }: { event: EventItem; type: TypeFilter }) {
  const main = categoryInfo(e.categories[0] ?? OTHER);
  // With a type selected, open the event on its first item of that type, and list those items first.
  const first = type === "all" ? undefined : e.videos.find((v) => kindOf(v) === type);
  const cover = first && kindOf(first) !== "audio" ? first : e.videos.find((v) => kindOf(v) !== "audio");
  const href = (id?: string) => (id ? `/events/${e.id}?v=${id}` : `/events/${e.id}`);
  // File names, except one that merely repeats the event title (a file placed directly in a category).
  const files = [...e.videos]
    .sort((a, b) => Number(kindOf(b) === type) - Number(kindOf(a) === type))
    .filter((v) => v.title !== e.title);
  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[0_10px_40px_-10px_#e3b45a40]">
      <Link href={href(first?.id)} className="block">
        <div className="relative aspect-video overflow-hidden bg-surface-2">
          <Thumbnail fileId={cover?.id} emoji={main.emoji} alt={e.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
          <span className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-gold/90 text-2xl text-bg opacity-0 transition group-hover:opacity-100">
            ▶
          </span>
          <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs">{mediaCount(e.videos)}</span>
          {isNew(e) && <span className="absolute top-2 right-2 rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-bg">חדש</span>}
          <span className="absolute top-2 left-2 max-w-[70%] truncate rounded-md bg-black/70 px-2 py-0.5 text-xs">
            {main.emoji} {main.label}
            {e.subcategory && e.subcategory !== e.title && ` · ${e.subcategory}`}
          </span>
        </div>
        <div className="px-4 pt-4">
          <p className="text-xs text-muted">{formatEventDate(e)}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug">{e.title}</h3>
        </div>
      </Link>
      <div className="px-4 pb-4">
        {files.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm" aria-label="קבצים">
            {files.slice(0, FILES_SHOWN).map((v) => (
              <li key={v.id}>
                <Link href={href(v.id)} className="flex items-baseline gap-1.5 text-muted hover:text-gold">
                  <span aria-hidden className="text-xs">
                    {KIND_ICON[kindOf(v)]}
                  </span>
                  <span className="line-clamp-1">{v.title}</span>
                </Link>
              </li>
            ))}
            {files.length > FILES_SHOWN && (
              <li>
                <Link href={href()} className="text-xs text-gold hover:underline">
                  +{files.length - FILES_SHOWN} נוספים
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
}
