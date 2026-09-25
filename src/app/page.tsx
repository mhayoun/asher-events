import { Suspense } from "react";
import { EventExplorer } from "@/components/EventExplorer";
import { CATEGORIES } from "@/lib/categories";
import { getPublicEvents } from "@/lib/store";

// Fresh data is pushed by the daily sync (revalidatePath); this is only a safety net.
export const revalidate = 3600;

export default async function Home() {
  const events = await getPublicEvents();
  const media = events.flatMap((e) => e.videos);
  const audio = media.filter((m) => m.kind === "audio").length;
  const categories = new Set(events.flatMap((e) => e.categories)).size;
  const years = events.map((e) => Number(e.date.slice(0, 4)));
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "";


  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,#e3b45a1f,transparent)]">
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
          <p className="text-sm tracking-widest text-gold">גלריית אירועים</p>
          <h1 className="mt-2 font-display text-4xl font-black leading-tight md:text-6xl">
            המוזיקה שמלווה
            <br />
            את השמחות שלכם
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            בריתות, בר מצוות, אירוסין, שבע ברכות, הכנסות ספר תורה ומסיבות בתלמודי תורה - וגם הופעות של התלמידים. בחרו קטגוריה, חפשו
            שם של שיר או סננו לפי תאריך.
          </p>
          <dl className="mt-8 flex flex-wrap gap-8">
            {[
              [events.length, "אירועים"],
              [media.length - audio, "סרטונים"],
              ...(audio ? [[audio, "הקלטות"]] : []),
              [Math.min(categories, CATEGORIES.length), "סוגי אירועים"],
              [span, "שנים"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd dir="ltr" className="text-right font-display text-3xl font-bold text-gold">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <Suspense>
        <EventExplorer events={events} />
      </Suspense>
    </>
  );
}
