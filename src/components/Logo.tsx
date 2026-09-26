/**
 * The studio logo from the lessons flyer, redrawn as SVG so it stays sharp at any size:
 * a golden sound wave with a stylised note/record in the middle.
 */
export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 90" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d488" />
          <stop offset="1" stopColor="#c9953a" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#logo-gold)" strokeWidth="3.4" strokeLinecap="round">
        {/* bars, short to tall, mirrored on both sides */}
        <path d="M9 43v6M16 38v16M23 33v26M30 24v44M66 24v44M73 33v26M80 38v16M87 43v6" />
        {/* upper stem curving into the left half, lower stem curving into the right half */}
        <path d="M52.9 8V38.5A9 9 0 0 0 39 46" />
        <path d="M43.1 84V53.5A9 9 0 0 0 57 46" />
      </g>
      <circle cx="48" cy="46" r="1.9" fill="url(#logo-gold)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-black text-gold">אשר חיון</span>
        <span className="mt-1 text-[0.65rem] tracking-[0.25em] text-muted">סטודיו למוזיקה</span>
      </span>
    </span>
  );
}
