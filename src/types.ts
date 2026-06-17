/** Video categories (subset used for the video feed). */
export type VideoCategory = "ai" | "hardware" | "software" | "science" | "general";

/** A YouTube channel we pull videos from. */
export interface VideoSource {
  id: string;
  name: string;
  channelId: string;
  /** Category applied to videos when the AI can't determine a better one. */
  defaultCategory: VideoCategory;
}

/** An AI-enriched video entry served to the app. */
export interface Video {
  id: string;
  title: string;
  titleFa: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
  youtubeUrl: string;
  captionFa: string;
  captionEn: string;
  category: VideoCategory;
  processedAt: string;
}

/** Canonical content categories. Persian labels live in the app (see app/lib/categories.ts). */
export type CategoryId =
  | "ai"
  | "startups"
  | "hardware"
  | "software"
  | "security"
  | "science"
  | "business"
  | "policy"
  | "general";

export const CATEGORY_IDS: CategoryId[] = [
  "ai",
  "startups",
  "hardware",
  "software",
  "security",
  "science",
  "business",
  "policy",
  "general",
];

/** A news source we pull from. */
export interface Source {
  id: string;
  name: string;
  /** Native (English) site name for attribution. */
  homepage: string;
  feedUrl: string;
}

/** A raw item straight off an RSS/Atom feed, before AI processing. */
export interface RawArticle {
  /** Stable id derived from the canonical link. */
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  link: string;
  /** Plain-text content/snippet from the feed (HTML stripped). */
  content: string;
  author?: string;
  publishedAt: string; // ISO 8601
  /** Hash of normalized title used for fast duplicate detection. */
  fingerprint: string;
  /** Hero image URL — from RSS media fields or og:image scraping. */
  imageUrl?: string;
}

/** The AI-enriched article served to the app. */
export interface ProcessedArticle extends RawArticle {
  /** Fluent Persian translation of the headline. */
  titleFa: string;
  /** 2-3 sentence Persian summary. */
  summaryFa: string;
  /** Bullet-point key insights in Persian. */
  insightsFa: string[];
  /** Why this matters, in Persian — the editorial angle. */
  whyItMattersFa: string;
  /** AI-assigned category. */
  category: CategoryId;
  /** Persian tags for discovery. */
  tagsFa: string[];
  /** Estimated read time of the original, in minutes. */
  readingMinutes: number;
  /** ids of other articles judged to be the same story (deduplication). */
  duplicateOf?: string;
  /** When the AI processing happened. */
  processedAt: string;
}
