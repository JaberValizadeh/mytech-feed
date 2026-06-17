import type { RawArticle } from "./types.js";
import { similarity } from "./util.js";

/** Similarity threshold above which two headlines are treated as the same story. */
const DUP_THRESHOLD = 0.6;

export interface DedupResult {
  /** The articles to keep (one canonical item per cluster). */
  unique: RawArticle[];
  /** Map of duplicate article id -> canonical article id it was merged into. */
  duplicateOf: Map<string, string>;
}

/**
 * Cheap, deterministic first-pass deduplication on headline fingerprints.
 * The canonical item of each cluster is the earliest-published one. This runs
 * before the (expensive) AI pass so we don't pay to translate the same story
 * five times. The AI layer can still refine cross-lingual/semantic dupes.
 */
export function deduplicate(articles: RawArticle[]): DedupResult {
  // Process oldest-first so the canonical item is the original report.
  const sorted = [...articles].sort(
    (a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt),
  );

  const unique: RawArticle[] = [];
  const duplicateOf = new Map<string, string>();

  for (const article of sorted) {
    const match = unique.find(
      (kept) =>
        kept.id === article.id ||
        similarity(kept.fingerprint, article.fingerprint) >= DUP_THRESHOLD,
    );
    if (match) {
      duplicateOf.set(article.id, match.id);
    } else {
      unique.push(article);
    }
  }

  return { unique, duplicateOf };
}
