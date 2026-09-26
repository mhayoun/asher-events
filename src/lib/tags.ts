import { normalize } from "./categories";
import type { EventItem } from "./types";

// Words too common to help narrow anything down.
const STOP_WORDS = new Set(
  ["של", "עם", "את", "על", "אל", "או", "גם", "זה", "זו", "כל", "לא", "כי", "אם", "מה", "הוא", "היא", "the", "and", "of", "in"].map(
    normalize,
  ),
);

// Expressions kept whole in the cloud instead of being split into words (spelling variants included).
const PHRASES: { label: string; re: RegExp }[] = [
  { label: "בר מצוה", re: /בר[\s-]*מצו{1,2}ה/g }, // בר מצוה / בר מצווה / בר-מצוה
  { label: "גבעת זאב", re: /גבעת[\s-]+ז[אע]ב/g }, // also the "גבעת זעב" spelling used in one folder
  { label: "ברית מילה", re: /ברית[\s-]+מילה/g },
  { label: "שבע ברכות", re: /שבע[\s-]+ברכות/g },
  // people
  { label: "אשר חיון", re: /אשר[\s-]+חיון|\basher\b/gi },
  { label: "אבי בריז", re: /אבי[\s-]+בריז/g },
  { label: "דוד מחמלי", re: /דוד[\s-]+מחמלי/g },
  { label: "אברהם קס", re: /אברהם[\s-]+קס/g },
  { label: "רב פיטוסי", re: /רב[\s-]+פיטוסי/g },
  // places and institutions
  { label: "מענה שמחה", re: /מענה[\s-]+שמחה/g },
  { label: "בית אהרון", re: /בית[\s-]+אהרו?ן/g },
  { label: "מושב אלמוג", re: /מושב[\s-]+אלמוג/g },
  { label: "מלון שלום", re: /מלון[\s-]+שלום/g },
  { label: "ישיבת תורה מציון", re: /ישיבת[\s-]+תורה[\s-]+מציון/g },
  // other expressions
  { label: "ילד הפלא", re: /ילד[\s-]+ה?פלא/g },
  { label: 'סיום הש"ס', re: /סיום[\s-]+ה?ש["״]?ס/g },
];

export interface Tag {
  id: string; // normalized word, used for matching and in ?tags=
  label: string; // the word as written in the titles
  count: number; // number of events whose titles contain it
}

/** Words of an event's title and of its files' titles: normalized form → a readable form. */
export function titleWords(e: EventItem): Map<string, string> {
  const words = new Map<string, string>();
  for (let title of [e.title, ...e.videos.map((v) => v.title)]) {
    for (const { label, re } of PHRASES)
      if (title.match(re)) {
        words.set(normalize(label), label);
        title = title.replace(re, " ");
      }
    // digits glued to words ("סוכות2021") are cut off so the word still counts
    for (const raw of title.replace(/\d+/g, " ").split(/[\s_\-–.+,()|/]+/)) {
      const word = raw.replace(/^["'׳״]+|["'׳״]+$/g, "");
      const id = normalize(word);
      if (id.length < 3 || /^\d+$/.test(id) || STOP_WORDS.has(id)) continue;
      if (!words.has(id)) words.set(id, word);
    }
  }
  return words;
}

/**
 * Tag cloud of the given events, most frequent first. Words found in every event are left out
 * (they can't narrow the list), except when there is a single event.
 */
export function tagCloud(events: EventItem[], max = 60): Tag[] {
  const tags = new Map<string, Tag>();
  for (const e of events)
    for (const [id, label] of titleWords(e)) {
      const t = tags.get(id);
      if (t) t.count++;
      else tags.set(id, { id, label, count: 1 });
    }
  return [...tags.values()]
    .filter((t) => events.length === 1 || t.count < events.length)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "he"))
    .slice(0, max);
}
