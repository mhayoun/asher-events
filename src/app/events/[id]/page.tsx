import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { categoryInfo } from "@/lib/categories";
import { driveFolderUrl, formatEventDate, mediaCount, thumbnailUrl } from "@/lib/format";
import { getPublicEvents } from "@/lib/events";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getPublicEvents()).map((e) => ({ id: e.id }));
}

async function getEvent(id: string) {
  return (await getPublicEvents()).find((e) => e.id === id);
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const event = await getEvent((await params).id);
  if (!event) return {};
  const cover = event.videos.find((v) => v.kind !== "audio");
  return {
    title: event.title,
    description: `${mediaCount(event.videos)} · ${formatEventDate(event)}`,
    openGraph: cover ? { images: [thumbnailUrl(cover.id, 1200)] } : undefined,
  };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const event = await getEvent((await params).id);
  if (!event) notFound();
  const main = categoryInfo(event.categories[0] ?? "other");

  return (
    <article className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-gold">
          כל האירועים
        </Link>
        {event.categories.map((c) => (
          <span key={c} className="flex items-center gap-2">
            <span aria-hidden>‹</span>
            <Link href={`/?cat=${encodeURIComponent(c)}#events`} className="hover:text-gold">
              {categoryInfo(c).emoji} {categoryInfo(c).label}
            </Link>
          </span>
        ))}
      </nav>
      <header className="mb-6 mt-3">
        <h1 className="mt-3 font-display text-3xl font-bold md:text-5xl">{event.title}</h1>
        <p className="mt-2 text-muted">
          {formatEventDate(event)}
          {event.location && ` · ${event.location}`} · {mediaCount(event.videos)} ·{" "}
          <a href={driveFolderUrl(event.id)} target="_blank" rel="noreferrer" className="text-gold hover:underline">
            התיקייה ב-Drive ↗
          </a>
        </p>
        {event.description && <p className="mt-3 max-w-3xl text-lg">{event.description}</p>}
      </header>
      <Suspense>
        <VideoPlayer videos={event.videos} emoji={main.emoji} />
      </Suspense>
    </article>
  );
}
