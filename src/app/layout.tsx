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
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
            <Link href="/" aria-label="אשר חיון - דף הבית" className="shrink-0">
              <Logo />
            </Link>
            <div className="flex min-w-0 flex-1 justify-center">
              <NavLinks />
            </div>
            <WhatsAppButton />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="flex flex-col items-center gap-3 border-t border-line py-6 text-center text-sm text-muted">
          <p>© {new Date().getFullYear()} אשר חיון · כל הסרטונים מתעדכנים אוטומטית מתיקיית האירועים</p>
          <SyncButton />
        </footer>
      </body>
    </html>
  );
}
