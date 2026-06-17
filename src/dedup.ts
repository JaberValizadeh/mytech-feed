import type { RawArticle } from "./types.js";
import { fingerprint, similarity } from "./util.js";

/**
 * Similarity threshold above which two articles are treated as the same story.
 * 0.6 = "60% similar". Applied to both the headline fingerprint and the
 * title+content fingerprint, so a story carried by several outlets clusters
 * together even when the headlines are reworded.
 */
const DUP_THRESHOLD = 0.6;

export interface DedupResult {
  /** The articles to keep (one canonical item per cluster). */
  unique: RawArticle[];
  /** Map of duplicate article id -> canonical article id it was merged into. */
  duplicateOf: Map<string, string>;
  /**
   * Canonical article id -> number of distinct sources that carried the story.
   * A count >= 2 means multiple outlets ran it, i.e. it's "hot".
   */
  sourceCount: Map<string, number>;
}

/**
 * Cheap, deterministic first-pass deduplication. Two articles are the same
 * story when their headline fingerprints OR their title+content fingerprints
 * are >= 60% similar (Jaccard). The canonical item of each cluster is the
 * earliest-published one. This runs before the (expensive) AI pass so we don't
 * pay to translate the same story five times — and, as a side effect, tells us
 * how many distinct sources covered each story (the "hot news" signal).
 */
export function deduplicate(articles: RawArticle[]): DedupResult {
  // Process oldest-first so the canonical item is the original report.
  const sorted = [...articles].sort(
    (a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt),
  );

  // Lazily-built fingerprint over title + body, cached per article id.
  const contentFpCache = new Map<string, string>();
  const contentFp = (a: RawArticle): string => {
    let fp = contentFpCache.get(a.id);
    if (fp === undefined) {
      fp = fingerprint(`${a.title} ${a.content ?? ""}`);
      contentFpCache.set(a.id, fp);
    }
    return fp;
  };

  const unique: RawArticle[] = [];
  const duplicateOf = new Map<string, string>();
  // Canonical id -> set of distinct source ids in its cluster.
  const clusterSources = new Map<string, Set<string>>();

  for (const article of sorted) {
    const match = unique.find(
      (kept) =>
        kept.id === article.id ||
        similarity(kept.fingerprint, article.fingerprint) >= DUP_THRESHOLD ||
        similarity(contentFp(kept), contentFp(article)) >= DUP_THRESHOLD,
    );
    if (match) {
      duplicateOf.set(article.id, match.id);
      clusterSources.get(match.id)!.add(article.sourceId);
    } else {
      unique.push(article);
      clusterSources.set(article.id, new Set([article.sourceId]));
    }
  }

  const sourceCount = new Map<string, number>();
  for (const [id, sources] of clusterSources) sourceCount.set(id, sources.size);

  return { unique, duplicateOf, sourceCount };
}
