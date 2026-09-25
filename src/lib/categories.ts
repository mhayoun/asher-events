/** File extensions of the media the sync picks up; stripped from titles. */
export const MEDIA_EXT_RE = /\.(mp4|m4v|mov|avi|mkv|webm|3gp|mpg|mpeg|wmv|mp3|m4a|wav|aac|ogg|oga|flac|wma)/gi;

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
  { id: "siyum", label: 'סיום הש"ס', emoji: "📚", keywords: ["סיום השס", "סיום שס", "סיום מסכת"] },
  { id: "sheva-brachot", label: "שבע ברכות", emoji: "🥂", keywords: ["שבע ברכות", "שבע-ברכות"] },
  { id: "avi-briz", label: "אבי בריז", emoji: "🎤", keywords: ["בריז"] },
  { id: "henna", label: "חינה", emoji: "🌺", keywords: ["חינה"] },
  { id: "kumzitz", label: "זיץ / הופעה", emoji: "🎶", keywords: ["זיץ", "הופעה", "מופע", "קונצרט"] },
  { id: "students", label: "תלמידים", emoji: "🎓", keywords: ["תלמיד", "תלמידי", "ילד הפלא", "ילד פלא", "ילדים"] },
  { id: "studio", label: "אולפן", emoji: "🎚️", keywords: ["אולפן", "סנטור", "santoor"] },
  { id: "covers", label: "קאברים", emoji: "🎷", keywords: ["קאבר", "cover"] },
  { id: "other", label: "אחר", emoji: "🎵", keywords: [] },
];

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/**
 * Categories created by the sync from folder titles (see extractCategoryLabel) have no entry
 * above: their id *is* their Hebrew label. This resolves both kinds.
 */
export function categoryInfo(id: string): Category {
  return CATEGORY_BY_ID[id] ?? { id, label: id, emoji: "🎵", keywords: [id] };
}

export const isAutoCategory = (id: string) => !(id in CATEGORY_BY_ID);

/** Built-in categories in their fixed order, then auto-created ones alphabetically, "אחר" last. */
export function orderCategories(ids: Iterable<string>): Category[] {
  const set = new Set(ids);
  const auto = [...set].filter(isAutoCategory).sort((a, b) => a.localeCompare(b, "he")).map(categoryInfo);
  const builtIn = CATEGORIES.filter((c) => set.has(c.id));
  return [...builtIn.filter((c) => c.id !== "other"), ...auto, ...builtIn.filter((c) => c.id === "other")];
}

/**
 * Normalizes Hebrew text for matching: strips niqqud, quotes/geresh, punctuation,
 * and collapses common spelling variants (מצווה → מצוה).
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // niqqud & cantillation
    .replace(/["'`׳״]/g, "")
    .replace(MEDIA_EXT_RE, "")
    .replace(/[_\-–.+,()]/g, " ")
    .replace(/וו/g, "ו")
    .replace(/יי/g, "י")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that start the "who / where" part of a folder title, e.g. "חינה משפחת כהן", "הופעה באולם השמחות".
const TITLE_BREAKERS = new Set([
  "של", "עם", "משפחת", "למשפחת", "לכבוד", "אצל", "ע\"י", "עי",
  "בבית", "באולם", "באולמי", "במלון", "במושב", "בקיבוץ", "בישיבת", "בישיבה", "בתלמוד", "בכולל", "בגן",
  "בשכונת", "בקהילת", "בעיר", "ברחוב", "בחצר", "בגבעת", "בירושלים", "בבני", "בפתח", "ברמת", "בקרית", "בנוף",
]);

/**
 * Turns a folder title into a category name when no known category fits:
 * drops years/numbers, then keeps the words before the first separator or "who / where" word,
 * at most 3 words.  "יום הולדת 40 משפחת כהן 2026" → "יום הולדת",  "הופעה באולם השמחות" → "הופעה".
 */
export function extractCategoryLabel(title: string): string {
  const head = title
    .replace(MEDIA_EXT_RE, "")
    .split(/\s[-–|:]\s|[,(]/)[0]
    .replace(/\d+/g, " ")
    .replace(/[_\-–]/g, " ");
  const words: string[] = [];
  for (const w of head.split(/\s+/).filter(Boolean)) {
    // a "ב…" word after the first two is almost always a place: "ל״ג בעומר במירון"
    if (words.length && (TITLE_BREAKERS.has(w) || (words.length >= 2 && w.startsWith("ב") && w.length >= 4))) break;
    words.push(w);
    if (words.length === 3) break;
  }
  return words.join(" ").trim();
}

/**
 * Categories of an event from its folder and file names. `extra` are categories auto-created for
 * earlier folders, so later folders with the same words join them. If nothing matches, a new
 * category is extracted from the folder title.
 */
export function classify(folderName: string, videoNames: string[], extra: Category[] = []): string[] {
  const haystacks = [folderName, ...videoNames].map(normalize);
  const found = [...CATEGORIES, ...extra]
    .filter((c) => c.keywords.some((k) => haystacks.some((h) => h.includes(normalize(k)))))
    .map((c) => c.id);
  if (found.length) return found;
  const label = extractCategoryLabel(folderName);
  return [label || "other"];
}
