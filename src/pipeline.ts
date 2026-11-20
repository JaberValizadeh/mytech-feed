import "dotenv/config";
import { enrichAll } from "./ai.js";
import { deduplicate } from "./dedup.js";
import { selectRetained, type RetentionCandidate } from "./retention.js";
import { fetchAll } from "./rss.js";
import { SOURCES } from "./sources.js";
import { loadArticles, saveArticles } from "./store.js";
import { mentionsPhysicalRobot, toStoredArticle } from "./util.js";
import type { ProcessedArticle } from "./types.js";

/** Thrown when aggregation can't run because no OpenAI key is configured. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    this.name = "MissingApiKeyError";
  }
}

/** Keep at most this many articles in the rolling store. */
const MAX_STORED = Number(process.env.MAX_STORED_ARTICLES ?? 600);
/** Newest articles guaranteed to each source, so slow blogs aren't crowded out. */
const MIN_PER_SOURCE = Number(process.env.MIN_ARTICLES_PER_SOURCE ?? 3);
const MAX_AGE_DAYS = Number(process.env.MAX_ARTICLE_AGE_DAYS ?? 30);
const HOT_MAX_AGE_DAYS = Number(process.env.HOT_ARTICLE_MAX_AGE_DAYS ?? 3);

/** Currently-configured source ids; articles from removed sources are dropped. */
const SOURCE_IDS = new Set(SOURCES.map((s) => s.id));

/** Sources that are always robotics, regardless of the AI's category guess. */
const ROBOTICS_SOURCES = new Set([
  "robohub",
  "ieee-robotics",
  "robotics-automation-news",
  "techxplore-robotics",
  "sciencedaily-robotics",
  "newatlas-robotics",
  "hackaday-robots",
]);


export interface AggregationResult {
  fetched: number;
  newlyEnriched: number;
  reused: number;
  total: number;
  sourcesTotal: number;
  failedSources: string[];
  /** Articles sent to the model, and how many of those failed or were skipped. */
  enrichAttempted: number;
  enrichFailed: number;
  quotaExhausted: boolean;
}

/**
 * One full aggregation cycle:
 *   fetch RSS → dedupe → choose what to keep → AI-enrich only what's kept and new
 *   → merge into a rolling store.
 *
 * Article ids are a stable hash of the canonical link, so anything we already
 * translated in a previous run is reused as-is. Retention is decided before the
 * model is called: this keeps the refresh cheap and stops stories being enriched,
 * evicted and then enriched again on the next run.
 */
export async function runAggregation(): Promise<AggregationResult> {
  if (!process.env.OPENAI_API_KEY) throw new MissingApiKeyError();

  const maxItems = Number(process.env.MAX_ITEMS_PER_SOURCE ?? 8);

  console.log(`\n[1/4] Fetching ${SOURCES.length} sources (max ${maxItems} each)…`);
  const { articles: raw, failedSources } = await fetchAll(SOURCES, maxItems);
  console.log(`      → ${raw.length} items fetched.`);

  console.log("\n[2/4] Deduplicating…");
  const { unique, duplicateOf, sourceCount } = deduplicate(raw);
  const hot = [...sourceCount.values()].filter((n) => n >= 2).length;
  console.log(
    `      → ${unique.length} unique, ${duplicateOf.size} duplicates removed, ${hot} hot (2+ sources).`,
  );

  // Reuse previously enriched articles so we only pay for genuinely new stories.
  // A cached article also counts as "fresh" if it predates a field we now
  // generate (e.g. summaryEn) — that way a schema addition backfills itself on
  // the next refresh instead of leaving old items half-translated.
  const prior = await loadArticles();
  const priorArticles = prior.articles
    .filter((a) => SOURCE_IDS.has(a.sourceId))
    .map(toStoredArticle);
  const cache = new Map(priorArticles.map((a) => [a.id, a]));
  const isComplete = (a: ProcessedArticle | undefined): a is ProcessedArticle =>
    !!a && typeof a.summaryEn === "string" && a.summaryEn.length > 0;

  // Decide what stays before spending anything on the model.
  const candidates = new Map<string, RetentionCandidate>();
  for (const a of priorArticles) candidates.set(a.id, a);
  for (const a of unique) {
    candidates.set(a.id, {
      id: a.id,
      sourceId: a.sourceId,
      publishedAt: a.publishedAt,
      sourceCount: sourceCount.get(a.id) ?? 1,
    });
  }
  const retained = selectRetained([...candidates.values()], {
    max: MAX_STORED,
    minPerSource: MIN_PER_SOURCE,
    maxAgeDays: MAX_AGE_DAYS,
    hotMaxAgeDays: HOT_MAX_AGE_DAYS,
  });

  const fresh = unique.filter((a) => retained.has(a.id) && !isComplete(cache.get(a.id)));
  const skipped = unique.filter((a) => !retained.has(a.id)).length;

  console.log(
    `\n[3/4] AI enrichment — ${fresh.length} new/backfill, ` +
      `${unique.length - fresh.length - skipped} reused from cache, ${skipped} not retained…`,
  );
  const result = await enrichAll(fresh, duplicateOf);
  // Stamp the freshly enriched canonicals with how many sources carried them.
  const enriched = result.articles.map((a) => ({
    ...a,
    sourceCount: sourceCount.get(a.id) ?? 1,
  }));

  // Items in this run we've already fully enriched: keep them, but refresh the
  // dup flag and source count (more outlets may have picked up the story since),
  // and backfill an image if the stored copy had none but we found one now.
  const reusedItems: ProcessedArticle[] = unique
    .filter((a) => retained.has(a.id) && isComplete(cache.get(a.id)))
    .map((a) => {
      const cached = cache.get(a.id)!;
      return {
        ...cached,
        duplicateOf: duplicateOf.get(a.id),
        sourceCount: Math.max(cached.sourceCount ?? 1, sourceCount.get(a.id) ?? 1),
        imageUrl: cached.imageUrl ?? a.imageUrl,
      };
    });

  // Merge this run with older stored items, unique by id, newest first.
  const byId = new Map<string, ProcessedArticle>();
  for (const a of [...enriched, ...reusedItems, ...priorArticles]) {
    if (!byId.has(a.id) && retained.has(a.id)) byId.set(a.id, a);
  }
  const merged = [...byId.values()]
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .map((a) => {
      const text = `${a.title} ${a.summaryEn ?? ""} ${a.titleFa} ${(a.tagsFa ?? []).join(" ")}`;
      // Robotics = dedicated robotics feeds, or a genuine physical-robot mention.
      if (ROBOTICS_SOURCES.has(a.sourceId) || mentionsPhysicalRobot(text)) {
        return { ...a, category: "robotics" as const };
      }
      // Demote software-bot stories the AI mislabeled robotics (Persian ربات=bot).
      if (a.category === "robotics") return { ...a, category: "ai" as const };
      return a;
    });

  console.log("\n[4/4] Saving…");
  // A run that produced nothing new must not look like a successful refresh:
  // keeping the old timestamp makes the next cron slot retry instead of waiting.
  const refreshed = fresh.length === 0 || enriched.length > 0;
  await saveArticles(merged, refreshed ? undefined : prior.generatedAt);
  console.log(`      → ${merged.length} articles in data/articles.json.\n`);

  return {
    fetched: raw.length,
    newlyEnriched: enriched.length,
    reused: reusedItems.length,
    total: merged.length,
    sourcesTotal: SOURCES.length,
    failedSources,
    enrichAttempted: fresh.length,
    enrichFailed: fresh.length - enriched.length,
    quotaExhausted: result.quotaExhausted,
  };
}
