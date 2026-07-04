import { createHash } from "node:crypto";

/** Short, stable, URL-safe id from any string (e.g. an article link). */
export function hashId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

/** Strip HTML tags and collapse whitespace into a plain-text snippet. */
export function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalized fingerprint of a headline for duplicate detection: lowercased,
 * punctuation removed, stopwords dropped, words sorted. Two articles about the
 * same event tend to collide here even with different wording/sources.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "by", "at", "as", "it", "its", "this",
  "that", "from", "new", "now", "how", "why", "what", "will", "has", "have",
]);

export function fingerprint(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).sort().join(" ");
}

/** Jaccard similarity between two fingerprints' word sets (0..1). */
export function similarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/** Rough reading time in minutes for an English source text (~220 wpm). */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Truncate text to a max length on a word boundary. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/** Ordered patterns for the social/share image in a page's <head>. */
const IMAGE_META_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
];

/**
 * Fetch the share image (og:image / twitter:image / …) from an article URL.
 * Reads a generous slice of the HTML because modern sites have large <head>s and
 * often place og:image well past the first several KB. Returns undefined on any
 * error or timeout (always safe to call).
 */
export async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A real browser UA — some CDNs 403/406 generic agents.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const text = await res.text();
    // <head> can be large; scan up to 200 KB (og:image is always in the head).
    const head = text.slice(0, 200_000);
    for (const re of IMAGE_META_PATTERNS) {
      const imageUrl = head.match(re)?.[1]?.trim();
      if (imageUrl && !imageUrl.startsWith("data:")) {
        try {
          return new URL(imageUrl, url).href; // resolve relative URLs
        } catch {
          // malformed URL — try the next pattern
        }
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** First usable <img> src from a chunk of article HTML (RSS content). */
export function firstImageInHtml(html: string | undefined, baseUrl: string): string | undefined {
  if (!html) return undefined;
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = m[1]?.trim();
    if (!src || src.startsWith("data:")) continue;
    // Skip tiny tracking pixels / spacers by obvious name hints.
    if (/(1x1|pixel|spacer|blank|tracking)\.(gif|png)/i.test(src)) continue;
    try {
      return new URL(src, baseUrl).href;
    } catch {
      // keep scanning
    }
  }
  return undefined;
}
