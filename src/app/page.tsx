import Image from "next/image";
import { Suspense } from "react";
import flyer from "../../public/lessons-flyer.jpeg";
import { EventExplorer } from "@/components/EventExplorer";
import { getPublicEvents } from "@/lib/events";

// Fresh data is pushed by the daily sync (revalidatePath); this is only a safety net.
export const revalidate = 3600;

export default async function Home() {
  const events = await getPublicEvents();
  const media = events.flatMap((e) => e.videos);
  const audio = media.filter((m) => m.kind === "audio").length;
  const categories = new Set(events.flatMap((e) => e.categories)).size;

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,#e3b45a1f,transparent)]">
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1fr_300px] md:items-center md:py-20 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="text-sm tracking-widest text-gold">גלריית אירועים</p>
            <h1 className="mt-2 font-display text-4xl font-black leading-tight md:text-6xl">
              המוזיקה שמלווה
              <br />
              את השמחות שלכם
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted">
              בריתות, בר מצוות, אירוסין, שבע ברכות, הכנסות ספר תורה ומסיבות
              בתלמודי תורה - וגם הופעות של התלמידים. בחרו קטגוריה, חפשו שם של
              שיר או סננו לפי תאריך.
            </p>
            <dl className="mt-8 flex flex-wrap gap-8">
              {[
                [events.length, "אירועים"],
                [media.length - audio, "סרטונים"],
                ...(audio ? [[audio, "הקלטות"]] : []),
                [categories, "קטגוריות"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd
                    dir="ltr"
                    className="text-right font-display text-3xl font-bold text-gold"
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <aside
            aria-labelledby="lessons-title"
            className="mx-auto w-full max-w-sm"
          >
            <h2 id="lessons-title" className="sr-only">
              לימודי מוזיקה בסטודיו של אשר חיון
            </h2>
            <a
              href="/lessons-flyer.jpeg"
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-line shadow-2xl transition hover:border-gold/60"
            >
              <Image
                src={flyer}
                alt="לימודי מוזיקה בסטודיו מקצועי: פיתוח קול, גיטרה, אורגן, תופים וכלי הקשה, כלי נשיפה ותאוריה מוזיקלית. הקלטות איכותיות במהלך הלימוד, לגילאי ילדים, נוער ומבוגרים, מותאם לציבור החרדי והדתי. גבעת זאב והסביבה, 052-2336877"
                priority
                sizes="(min-width: 1024px) 340px, (min-width: 768px) 300px, 100vw"
                className="h-auto w-full"
              />
            </a>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href="https://wa.me/972522336877?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A9%D7%9E%D7%97%20%D7%9C%D7%A4%D7%A8%D7%98%D7%99%D7%9D%20%D7%A2%D7%9C%20%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%20%D7%9E%D7%95%D7%96%D7%99%D7%A7%D7%94"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#25D366] px-3 py-2.5 text-center text-sm font-semibold text-[#0b2e17] transition hover:brightness-110"
              >
                WhatsApp לתיאום שיעור
              </a>
              <a
                href="tel:+972522336877"
                dir="ltr"
                className="rounded-xl border border-gold px-3 py-2.5 text-center text-sm font-semibold text-gold transition hover:bg-gold-soft"
              >
                052-2336877
              </a>
            </div>
          </aside>
        </div>
      </section>
      <Suspense>
        <EventExplorer events={events} />
      </Suspense>
    </>
  );
}
