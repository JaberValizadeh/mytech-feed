/** Video categories (subset used for the video feed). */
export type VideoCategory = "ai" | "robotics" | "hardware" | "software" | "science" | "general";

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

/**
 * A paid native ad / sponsored post, managed by the app owner (not from RSS).
 * Rendered inline in the feed as a clearly-labeled card that links to the
 * advertiser. Stored separately so the RSS pipeline never touches it.
 */
export interface Sponsor {
  id: string;
  /** Brand/advertiser name shown in small print on the card. */
  advertiser: string;
  titleFa: string;
  titleEn: string;
  bodyFa: string;
  bodyEn: string;
  /** Creative image URL (optional). */
  imageUrl?: string;
  /** Where tapping the card sends the user. */
  ctaUrl: string;
  ctaTextFa?: string;
  ctaTextEn?: string;
  /** Off switches the ad without deleting it. */
  active: boolean;
  /** Optional flight window (ISO 8601). Outside it, the ad is not served. */
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

/** Canonical content categories. Persian labels live in the app (see app/lib/categories.ts). */
export type CategoryId =
  | "ai"
  | "robotics"
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
  "robotics",
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
  /** 2-3 sentence English summary (shown in the app's English mode). */
  summaryEn: string;
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
  /** Distinct sources that carried this story; >= 2 marks it as "hot news". */
  sourceCount?: number;
  /** When the AI processing happened. */
  processedAt: string;
}
