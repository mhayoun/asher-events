import { Suspense } from "react";
import { EventExplorer } from "@/components/EventExplorer";
import { getPublicEvents } from "@/lib/events";

// Fresh data is pushed by the daily sync (revalidatePath); this is only a safety net.
export const revalidate = 3600;

export default async function Home() {
  const events = await getPublicEvents();

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,#e3b45a1f,transparent)]">
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
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
          </div>
        </div>
      </section>
      <Suspense>
        <EventExplorer events={events} />
      </Suspense>
    </>
  );
}
