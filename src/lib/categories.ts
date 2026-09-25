export interface Category {
  id: string;
  label: string;
  emoji: string;
  /** Matched against the normalized folder name and video names. */
  keywords: string[];
}

// Order matters only for display. Add keywords here when new kinds of events appear in Drive.
export const CATEGORIES: Category[] = [
  { id: "erusin", label: "אירוסין", emoji: "💍", keywords: ["אירוסין", "אירוסים", "וורט", "ווארט"] },
  { id: "wedding", label: "חתונה", emoji: "🎊", keywords: ["חתונה", "חופה"] },
  { id: "bar-mitzvah", label: "בר מצוה", emoji: "📜", keywords: ["בר מצוה", "בר-מצוה", "תפילין"] },
  { id: "brit", label: "ברית מילה", emoji: "👶", keywords: ["ברית", "שלום זכר"] },
  { id: "sefer-torah", label: "הכנסת ספר תורה", emoji: "🕍", keywords: ["ספר תורה", "הכנסת ספר"] },
  { id: "chumash", label: "מסיבת חומש", emoji: "📖", keywords: ["חומש", "סידור"] },
  { id: "chanukah", label: "מסיבת חנוכה", emoji: "🕎", keywords: ["חנוכה"] },
  { id: "sukkot", label: "סוכות", emoji: "🌿", keywords: ["סוכות", "שמחת בית השואבה", "שמחת תורה"] },
  { id: "siyum", label: 'סיום הש"ס', emoji: "📚", keywords: ["סיום השס", "סיום שס", "סיום מסכת", "סיום"] },
  { id: "sheva-brachot", label: "שבע ברכות", emoji: "🥂", keywords: ["שבע ברכות", "שבע-ברכות"] },
  { id: "avi-briz", label: "אבי בריז", emoji: "🎤", keywords: ["בריז"] },
  { id: "henna", label: "חינה", emoji: "🌺", keywords: ["חינה"] },
  { id: "kumzitz", label: "זיץ / הופעה", emoji: "🎶", keywords: ["זיץ", "הופעה", "מופע", "קונצרט"] },
  { id: "students", label: "תלמידים", emoji: "🎓", keywords: ["תלמיד", "תלמידי", "ילד הפלא", "ילד פלא", "ילדים"] },
  { id: "studio", label: "אולפן", emoji: "🎚️", keywords: ["אולפן", "סנטור", "santoor"] },
  { id: "covers", label: "קאברים", emoji: "🎷", keywords: ["קאבר", "cover"] },
  { id: "other", label: "אחר", emoji: "🎵", keywords: [] },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/**
 * Normalizes Hebrew text for matching: strips niqqud, quotes/geresh, punctuation,
 * and collapses common spelling variants (מצווה → מצוה).
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // niqqud & cantillation
    .replace(/["'`׳״]/g, "")
    .replace(/\.(mp4|m4v|mov|avi|mkv|webm|mp3|m4a|wav|aac|ogg|flac)$/i, "")
    .replace(/[_\-–.+,()]/g, " ")
    .replace(/וו/g, "ו")
    .replace(/יי/g, "י")
    .replace(/\s+/g, " ")
    .trim();
}

export function classify(folderName: string, videoNames: string[]): string[] {
  const haystacks = [folderName, ...videoNames].map(normalize);
  const found = CATEGORIES.filter(
    (c) => c.keywords.length && c.keywords.some((k) => haystacks.some((h) => h.includes(normalize(k)))),
  ).map((c) => c.id);
  return found.length ? found : ["other"];
}
