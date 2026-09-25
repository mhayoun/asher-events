/** File extensions of the media the sync picks up; stripped from titles. */
export const MEDIA_EXT_RE = /\.(mp4|m4v|mov|avi|mkv|webm|3gp|mpg|mpeg|wmv|mp3|m4a|wav|aac|ogg|oga|flac|wma)/gi;

/** Categories are the folders directly under the Drive root; an event's category is its parent folder's name. */
export interface Category {
  id: string; // the folder name, also used in ?cat= links
  label: string;
  emoji: string;
}

export const OTHER = "אחר";

// Icons for category names, matched by keyword. Anything else gets 🎵. Order = first match wins.
const ICONS: [string[], string][] = [
  [["אירוסין", "אירוסים", "וורט"], "💍"],
  [["חתונה", "חופה"], "🎊"],
  [["בר מצוה", "בת מצוה", "תפילין"], "📜"],
  [["ברית", "שלום זכר"], "👶"],
  [["ספר תורה"], "🕍"],
  [["חומש", "סידור"], "📖"],
  [["חנוכה"], "🕎"],
  [["סוכות", "שמחת תורה"], "🌿"],
  [["סיום"], "📚"],
  [["שבע ברכות"], "🥂"],
  [["חינה"], "🌺"],
  [["מקהלה", "מקהלת"], "🎙️"],
  [["תזמורת"], "🎺"],
  [["כלי נגינה", "סקסופון", "סנטור", "מפוחית"], "🎷"],
  [["ילד הפלא", "ילדים", "תלמיד"], "🌟"],
  [["אולפן"], "🎚️"],
  [["זיץ", "הופעה", "מופע", "אירועים"], "🎤"],
];

export function categoryInfo(id: string): Category {
  const n = normalize(id);
  const emoji = ICONS.find(([keys]) => keys.some((k) => n.includes(normalize(k))))?.[1] ?? "🎵";
  return { id, label: id, emoji };
}

/** Categories alphabetically (like Drive shows the folders), "אחר" last. */
export function orderCategories(ids: Iterable<string>): Category[] {
  return [...new Set(ids)]
    .sort((a, b) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b, "he")))
    .map(categoryInfo);
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
