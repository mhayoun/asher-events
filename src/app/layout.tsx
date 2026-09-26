import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { SyncButton } from "@/components/SyncButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const frank = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"], weight: ["500", "700", "900"] });

export const metadata: Metadata = {
  // Absolute URLs for link previews (WhatsApp, Facebook…)
  metadataBase: new URL("https://asherhayoun.com"),
  title: { default: "אשר חיון · אירועים ונגינה", template: "%s · אשר חיון" },
  description: "גלריית הווידאו של אשר חיון - מורה למוזיקה: בר מצוות, בריתות, שבע ברכות, הכנסות ספר תורה, מסיבות חומש ועוד.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/95">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
            <Link href="/" aria-label="אשר חיון · סטודיו למוזיקה - דף הבית">
              <Logo />
            </Link>
            <div className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1">
              <NavLinks />
            </div>
            <SyncButton />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-sm text-muted">
          © {new Date().getFullYear()} אשר חיון · כל הסרטונים מתעדכנים אוטומטית מתיקיית האירועים
        </footer>
        <WhatsAppButton />
      </body>
    </html>
  );
}
