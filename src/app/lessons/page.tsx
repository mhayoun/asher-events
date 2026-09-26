import type { Metadata } from "next";
import Image from "next/image";
import flyer from "../../../public/lessons-flyer.jpeg";
import { PHONE_DISPLAY, TEL_URL, WHATSAPP_URL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "לימודי מוזיקה",
  description:
    "לימודי מוזיקה בסטודיו מקצועי בגבעת זאב והסביבה: פיתוח קול, גיטרה, אורגן, תופים, כלי נשיפה ותאוריה. לילדים, נוער ומבוגרים.",
  openGraph: { images: ["/lessons-flyer.jpeg"] },
};

export default function LessonsPage() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <div className="grid gap-10 md:grid-cols-[1fr_380px] md:items-start">
        <div>
          <p className="text-sm tracking-widest text-gold">סטודיו מקצועי</p>
          <h1 className="mt-2 font-display text-4xl font-black leading-tight md:text-6xl">לימודי מוזיקה</h1>
          <p className="mt-3 font-display text-2xl text-gold">בואו לנגן. להרגיש. לצמוח.</p>
          <ul className="mt-6 grid grid-cols-2 gap-2 text-lg">
            {["🎤 פיתוח קול", "🎸 גיטרה", "🎹 אורגן", "🥁 תופים וכלי הקשה", "🎷 כלי נשיפה", "🎼 תאוריה מוזיקלית"].map((item) => (
              <li key={item} className="rounded-xl border border-line bg-surface px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-1.5 text-muted">
            <li>⭐ יחס אישי ותוצאות אמיתיות</li>
            <li>🎧 הקלטות איכותיות במהלך הלימוד, בסטודיו מאובזר ברמה מקצועית</li>
            <li>👨‍👩‍👧 לגילאי ילדים, נוער ומבוגרים</li>
            <li>📍 גבעת זאב והסביבה · מותאם לציבור החרדי / דתי</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[#25D366] px-5 py-3 font-semibold text-[#0b2e17] transition hover:brightness-110"
            >
              WhatsApp לתיאום שיעור
            </a>
            <a
              href={TEL_URL}
              dir="ltr"
              className="rounded-xl border border-gold px-5 py-3 font-semibold text-gold transition hover:bg-gold-soft"
            >
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>

        <a
          href="/lessons-flyer.jpeg"
          target="_blank"
          rel="noreferrer"
          className="mx-auto block w-full max-w-sm overflow-hidden rounded-2xl border border-line shadow-2xl transition hover:border-gold/60"
        >
          <Image
            src={flyer}
            alt="פלייר לימודי מוזיקה בסטודיו של אשר חיון"
            priority
            sizes="(min-width: 768px) 380px, 100vw"
            className="h-auto w-full"
          />
        </a>
      </div>
    </article>
  );
}
