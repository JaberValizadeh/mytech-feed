import Parser from "rss-parser";
import type { RawArticle, Source } from "./types.js";
import { fetchOgImage, fingerprint, hashId, stripHtml, truncate } from "./util.js";

type MediaItem = { $?: { url?: string } };
type RssItem = Parser.Item & {
  mediaContent?: MediaItem | MediaItem[];
  mediaThumbnail?: MediaItem;
  enclosure?: { url?: string; type?: string };
};

const parser = new Parser<Record<string, unknown>, RssItem>({
  timeout: 15000,
  headers: { "User-Agent": "TechNewsPersian/1.0 (+aggregator)" },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

/** Extract the best image URL from an RSS item's media fields. */
function rssImageUrl(item: RssItem): string | undefined {
  // media:content (sometimes an array of resolutions — pick first)
  if (item.mediaContent) {
    const mc = Array.isArray(item.mediaContent) ? item.mediaContent[0] : item.mediaContent;
    const url = mc?.$?.url;
    if (url) return url;
  }
  // media:thumbnail
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$!.url;
  // enclosure (images only — skip audio/video)
  if (item.enclosure?.url) {
    const type = item.enclosure.type ?? "";
    if (type.startsWith("image/") || type === "") return item.enclosure.url;
  }
  return undefined;
}

/** Fetch and normalize up to `maxItems` recent items from one source. */
export async function fetchSource(
  source: Source,
  maxItems: number,
): Promise<RawArticle[]> {
  const feed = await parser.parseURL(source.feedUrl);
  const items = (feed.items ?? []).slice(0, maxItems);

  return items
    .map((item): RawArticle | null => {
      const link = item.link?.trim();
      const title = item.title?.trim();
      if (!link || !title) return null;

      const rawContent =
        (item as { "content:encoded"?: string })["content:encoded"] ??
        item.content ??
        item.contentSnippet ??
        item.summary ??
        "";

      const content = truncate(stripHtml(rawContent), 4000);
      const publishedAt = item.isoDate ?? new Date().toISOString();

      return {
        id: hashId(link),
        sourceId: source.id,
        sourceName: source.name,
        title,
        link,
        content,
        author: item.creator ?? (item as { author?: string }).author,
        publishedAt,
        fingerprint: fingerprint(title),
        imageUrl: rssImageUrl(item),
      };
    })
    .filter((a): a is RawArticle => a !== null);
}

/** Fetch every source in parallel; failures are logged and skipped, not fatal. */
export async function fetchAll(
  sources: Source[],
  maxItems: number,
): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    sources.map((s) => fetchSource(s, maxItems)),
  );

  const articles: RawArticle[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
      console.log(`  ✓ ${sources[i].name}: ${result.value.length} items`);
    } else {
      console.warn(`  ✗ ${sources[i].name}: ${String(result.reason).slice(0, 120)}`);
    }
  });

  // Fill in og:image for articles that had no RSS media field.
  await fillMissingImages(articles);

  return articles;
}

/**
 * For articles without an image from their RSS feed, scrape og:image from the
 * article URL. Runs with bounded concurrency to avoid hammering sites.
 */
async function fillMissingImages(
  articles: RawArticle[],
  concurrency = 10,
): Promise<void> {
  const missing = articles.filter((a) => !a.imageUrl);
  if (missing.length === 0) return;
  console.log(`  → fetching og:image for ${missing.length} articles without RSS media…`);

  let index = 0;
  async function worker(): Promise<void> {
    while (index < missing.length) {
      const article = missing[index++];
      article.imageUrl = await fetchOgImage(article.link);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));

  const filled = articles.filter((a) => a.imageUrl).length;
  console.log(`  → ${filled}/${articles.length} articles now have images.`);
}
