// Lightweight lexical retrieval over the bundled knowledge base.
// No embeddings required — good enough for a small, mostly-static corpus.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHUNKS = JSON.parse(
  readFileSync(join(__dirname, "..", "lib", "knowledge.json"), "utf8"),
);

// Common Persian stopwords to keep scoring focused on meaningful terms.
const STOPWORDS = new Set([
  "و", "در", "به", "از", "که", "این", "را", "با", "های", "برای", "است", "هست",
  "یک", "تا", "هم", "یا", "بر", "می", "شود", "شده", "کرد", "کنید", "آن", "اگر",
  "هر", "چه", "چی", "ما", "شما", "آیا", "بود", "باید", "همه", "نیز", "طور",
]);

function normalizeFa(input) {
  return input
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[آأإ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    .replace(/‌/g, " ")
    .replace(/[ً-ْ]/g, "")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .toLowerCase();
}

function tokenize(input) {
  return normalizeFa(input)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// Pre-normalize chunks once at module load.
const INDEX = CHUNKS.map((chunk) => ({
  chunk,
  title: normalizeFa(chunk.title),
  body: normalizeFa(chunk.text),
}));

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

export function retrieve(query, topK = 4) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !INDEX.length) return [];

  const scored = [];
  for (const entry of INDEX) {
    let score = 0;
    for (const term of terms) {
      const inBody = countOccurrences(entry.body, term);
      if (inBody > 0) score += Math.min(inBody, 3);
      if (entry.title.includes(term)) score += 2;
    }
    if (score > 0) {
      scored.push({ ...entry.chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function knowledgeSize() {
  return CHUNKS.length;
}
