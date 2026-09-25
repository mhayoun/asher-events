import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const frank = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"], weight: ["500", "700", "900"] });

export const metadata: Metadata = {
  title: { default: "אשר חיון · אירועים ונגינה", template: "%s · אשר חיון" },
  description: "גלריית הווידאו של אשר חיון - מורה למוזיקה: בר מצוות, בריתות, שבע ברכות, הכנסות ספר תורה, מסיבות חומש ועוד.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-bg">♪</span>
              אשר חיון
            </Link>
            <span className="hidden text-sm text-muted sm:inline">מוזיקה לאירועים · הוראת נגינה</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-sm text-muted">
          © {new Date().getFullYear()} אשר חיון · כל הסרטונים מתעדכנים אוטומטית מתיקיית האירועים
        </footer>
      </body>
    </html>
  );
}
