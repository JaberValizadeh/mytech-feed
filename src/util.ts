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

/**
 * Fetch the og:image from an article URL by scraping the HTML <head>.
 * Returns undefined on any error or timeout (always safe to call).
 */
export async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TechNewsPersian/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    // Only parse enough of the HTML to find <head> — avoids loading the body.
    const text = await res.text();
    const head = text.slice(0, 8000);
    const match =
      head.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      head.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const imageUrl = match?.[1];
    if (!imageUrl || imageUrl.startsWith("data:")) return undefined;
    // Resolve relative URLs.
    return new URL(imageUrl, url).href;
  } catch {
    return undefined;
  }
}
