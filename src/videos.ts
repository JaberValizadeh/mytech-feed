import "dotenv/config";
import Parser from "rss-parser";
import OpenAI from "openai";
import type { Video, VideoCategory } from "./types.js";
import { VIDEO_SOURCES } from "./videoSources.js";
import { loadVideos, saveVideos } from "./store.js";
import { isQuotaError } from "./ai.js";
import { mentionsPhysicalRobot, paceAiRequest, truncate } from "./util.js";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_STORED_VIDEOS = Number(process.env.MAX_STORED_VIDEOS ?? 150);
const MAX_VIDEOS_PER_CHANNEL = Number(process.env.MAX_VIDEOS_PER_CHANNEL ?? 5);
/** Slots every channel is guaranteed in the store, before recency fills the rest. */
const MIN_PER_CHANNEL = Number(process.env.MIN_VIDEOS_PER_CHANNEL ?? 2);
const MAX_VIDEO_AGE_DAYS = Number(process.env.MAX_VIDEO_AGE_DAYS ?? 3 * 365);
const CHANNEL_FETCH_CONCURRENCY = 5;

const VIDEO_CATEGORIES: VideoCategory[] = ["ai", "robotics", "hardware", "software", "science", "general"];

/** Channels whose videos are always robotics (real-robot channels only). */
const ROBOTICS_CHANNELS = new Set([
  "Boston Dynamics",
  "Unitree Robotics",
  "Agility Robotics",
  "ANYbotics",
  "Skyentific",
  "James Bruton",
  "K-Scale Labs",
  "Simone Giertz",
  "Articulated Robotics",
  "PRO ROBOTS",
  "ABB Robotics",
  "FANUC America",
  "Dobot Robotics",
  "VEX Robotics",
  "RoboCup",
  "IHMC Robotics",
  "DroneBot Workshop",
]);


let _client: OpenAI | null = null;
function client(): OpenAI {
  // 8 retries with exponential backoff turns a rate-limited batch into a crawl.
  if (!_client) {
    _client = new OpenAI({ maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 3) });
  }
  return _client;
}

type YtItem = Parser.Item & {
  ytVideoId?: string;
  mediaGroup?: { "media:description"?: string[] };
};

const parser = new Parser<Record<string, unknown>, YtItem>({
  timeout: 15000,
  headers: { "User-Agent": "MyTech/1.0 (+aggregator)" },
  customFields: {
    item: [
      ["yt:videoId", "ytVideoId"],
      // YouTube keeps the description here; Atom content/summary are absent.
      ["media:group", "mediaGroup"],
    ],
  },
});

/** The video's description from a YouTube feed entry ("" if it has none). */
export function youtubeDescription(item: YtItem): string {
  return item.mediaGroup?.["media:description"]?.[0]?.trim() ?? "";
}

/** Shorts are excluded: this tab is for videos worth a summary. */
const isShort = (url: string) => /\/shorts\//.test(url);

/** YouTube's feed fails intermittently, so retry before giving up on a channel. */
async function parseWithRetry(url: string, attempts = 3): Promise<Parser.Output<YtItem>> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      if (attempt >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/** Run tasks with a concurrency limit, settling each like Promise.allSettled. */
async function settleWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

const VIDEO_ENRICHMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    titleFa: {
      type: "string",
      description: "ترجمه روان و طبیعی عنوان ویدیو به فارسی",
    },
    captionFa: {
      type: "string",
      description: "خلاصه دو تا سه جمله‌ای محتوای ویدیو به فارسی",
    },
    captionEn: {
      type: "string",
      description: "2-3 sentence English summary of the video content",
    },
    category: {
      type: "string",
      enum: VIDEO_CATEGORIES,
    },
  },
  required: ["titleFa", "captionFa", "captionEn", "category"],
} as const;

interface VideoEnrichment {
  titleFa: string;
  captionFa: string;
  captionEn: string;
  category: VideoCategory;
}

const VIDEO_SYSTEM_PROMPT = `تو دستیار هوش مصنوعی یک سرویس خبری فناوری هستی.
وظیفه تو: عنوان ویدیوهای یوتیوب درباره فناوری و علم را به فارسی ترجمه کن و یک خلاصه کوتاه بنویس.

قواعد:
- فارسی روان، حرفه‌ای و بدون غلط بنویس.
- نام‌های انگلیسی شرکت‌ها، محصولات و اصطلاحات فنی را به انگلیسی نگه دار.
- captionEn را فقط به انگلیسی بنویس.
- captionFa را فقط به فارسی بنویس.
- فقط از عنوان و توضیحات داده‌شده استفاده کن و چیزی از خودت اضافه نکن. اگر توضیحاتی در دسترس نیست، در یک جمله فقط موضوع ویدیو را بر اساس عنوان بگو و درباره محتوای آن ادعایی نکن.`;

async function enrichVideo(
  title: string,
  description: string,
  channelName: string,
  defaultCategory: VideoCategory,
): Promise<VideoEnrichment> {
  const userContent = `کانال: ${channelName}
عنوان ویدیو: ${title}
توضیحات: ${truncate(description, 800) || "(توضیحاتی در دسترس نیست)"}

راهنمای دسته: ai=هوش مصنوعی و یادگیری ماشین (شامل چت‌بات و ایجنت)، robotics=فقط ربات‌های فیزیکی واقعی (ربات انسان‌نما، بازوی رباتیک، پهپاد، ربات صنعتی، ربات چهارپا)؛ چت‌بات و بات نرم‌افزاری robotics نیستند، hardware=سخت‌افزار و گجت، software=نرم‌افزار و برنامه‌نویسی، science=علم و پژوهش، general=فناوری عمومی.
دسته پیش‌فرض این کانال: ${defaultCategory}`;

  await paceAiRequest();
  const response = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      { role: "system", content: VIDEO_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_enrichment",
        strict: true,
        schema: VIDEO_ENRICHMENT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });

  const message = response.choices[0]?.message;
  if (message?.refusal) throw new Error(`Model refused: ${message.refusal}`);
  if (!message?.content) throw new Error("Empty model response");
  return JSON.parse(message.content) as VideoEnrichment;
}

interface RawVideo {
  id: string;
  title: string;
  description: string;
  channelName: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
  defaultCategory: VideoCategory;
}

/** Extract the YouTube video ID from a watch URL. */
function extractVideoId(url: string): string | undefined {
  return url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1];
}

/** Fetch the latest videos from one YouTube channel's RSS feed. */
async function fetchChannel(
  channelId: string,
  channelName: string,
  defaultCategory: VideoCategory,
): Promise<RawVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const feed = await parseWithRetry(feedUrl);
  // Filter before slicing, so Shorts don't use up a channel's slots.
  const items = (feed.items ?? [])
    .filter((item) => !isShort(item.link ?? ""))
    .slice(0, MAX_VIDEOS_PER_CHANNEL);

  return items
    .map((item): RawVideo | null => {
      const link = item.link?.trim();
      const title = item.title?.trim();
      if (!link || !title) return null;

      const videoId = item.ytVideoId ?? extractVideoId(link);
      if (!videoId) return null;

      const description = youtubeDescription(item);
      const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      return {
        id: videoId,
        title,
        description,
        channelName,
        youtubeUrl: link,
        thumbnailUrl,
        publishedAt: item.isoDate ?? new Date().toISOString(),
        defaultCategory,
      };
    })
    .filter((v): v is RawVideo => v !== null);
}

export interface VideoAggregationResult {
  newlyEnriched: number;
  total: number;
  channelsTotal: number;
  failedChannels: string[];
  enrichAttempted: number;
  enrichFailed: number;
  quotaExhausted: boolean;
}

/**
 * Pick which videos stay: every channel's newest few (a pure newest-first cap
 * starves slow-posting channels like Karpathy or 3Blue1Brown), then the newest
 * overall. Runs before enrichment so an evicted video is never paid for.
 */
function selectVideos(
  videos: { id: string; channelName: string; publishedAt: string }[],
): Set<string> {
  const byDate = [...videos].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  );
  const kept = new Set<string>();
  const perChannel = new Map<string, number>();
  for (const v of byDate) {
    if (kept.size >= MAX_STORED_VIDEOS) break;
    const n = perChannel.get(v.channelName) ?? 0;
    if (n < MIN_PER_CHANNEL) {
      kept.add(v.id);
      perChannel.set(v.channelName, n + 1);
    }
  }
  for (const v of byDate) {
    if (kept.size >= MAX_STORED_VIDEOS) break;
    kept.add(v.id);
  }
  return kept;
}

/**
 * Full video aggregation cycle:
 *   fetch YouTube RSS feeds → choose what to keep → AI-enrich new → merge rolling store.
 */
export async function runVideoAggregation(): Promise<VideoAggregationResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[videos] OPENAI_API_KEY not set — skipping video enrichment.");
    return {
      newlyEnriched: 0,
      total: 0,
      channelsTotal: VIDEO_SOURCES.length,
      failedChannels: [],
      enrichAttempted: 0,
      enrichFailed: 0,
      quotaExhausted: false,
    };
  }

  console.log(`\n[videos 1/4] Fetching ${VIDEO_SOURCES.length} YouTube channels…`);
  const rawResults = await settleWithLimit(
    VIDEO_SOURCES.map(
      (src) => () => fetchChannel(src.channelId, src.name, src.defaultCategory),
    ),
    CHANNEL_FETCH_CONCURRENCY,
  );

  const rawVideos: RawVideo[] = [];
  const failedChannels: string[] = [];
  rawResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      rawVideos.push(...result.value);
      console.log(`  ✓ ${VIDEO_SOURCES[i].name}: ${result.value.length} videos`);
    } else {
      failedChannels.push(VIDEO_SOURCES[i].name);
      console.warn(`  ✗ ${VIDEO_SOURCES[i].name}: ${String(result.reason).slice(0, 120)}`);
    }
  });
  console.log(`      → ${rawVideos.length} videos fetched.`);

  const prior = await loadVideos();
  const oldest = Date.now() - MAX_VIDEO_AGE_DAYS * 24 * 3600 * 1000;
  const inScope = (v: { youtubeUrl: string; publishedAt: string }) =>
    !isShort(v.youtubeUrl) && new Date(v.publishedAt).getTime() >= oldest;

  const priorById = new Map(prior.videos.filter(inScope).map((v) => [v.id, v]));
  const rawInScope = rawVideos.filter(inScope);
  const kept = selectVideos([
    ...new Map(
      [...priorById.values(), ...rawInScope].map((v) => [v.id, v] as const),
    ).values(),
  ]);

  // New videos, plus older captions written from the title alone, now that the
  // real description is available.
  const freshRaw = rawInScope.filter((v) => {
    if (!kept.has(v.id)) return false;
    const known = priorById.get(v.id);
    return !known || (!known.captionFromDescription && v.description.length > 0);
  });
  console.log(`\n[videos 2/4] AI enrichment — ${freshRaw.length} new/backfill…`);

  const concurrency = Number(process.env.AI_CONCURRENCY ?? 2);
  const enriched: Video[] = [];
  let index = 0;
  // Same as the article pipeline: once the quota is gone every call fails alike.
  let quotaExhausted = false;

  async function worker(): Promise<void> {
    while (index < freshRaw.length && !quotaExhausted) {
      const raw = freshRaw[index++];
      const n = index;
      try {
        const e = await enrichVideo(raw.title, raw.description, raw.channelName, raw.defaultCategory);
        enriched.push({
          id: raw.id,
          title: raw.title,
          titleFa: e.titleFa,
          channelName: raw.channelName,
          thumbnailUrl: raw.thumbnailUrl,
          publishedAt: raw.publishedAt,
          youtubeUrl: raw.youtubeUrl,
          captionFa: e.captionFa,
          captionEn: e.captionEn,
          category: e.category,
          processedAt: new Date().toISOString(),
          captionFromDescription: raw.description.length > 0,
        });
        console.log(`  ✓ [${n}/${freshRaw.length}] ${e.titleFa}`);
      } catch (err) {
        if (isQuotaError(err)) {
          quotaExhausted = true;
          console.warn("  ✗ OpenAI quota exhausted — stopping video enrichment.");
          break;
        }
        console.warn(
          `  ✗ [${n}/${freshRaw.length}] ${raw.title}: ${String(err).slice(0, 120)}`,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, freshRaw.length || 1) }, worker),
  );

  // Fresh captions win; a failed re-enrichment keeps the existing one.
  const byId = new Map<string, Video>();
  for (const v of [...enriched, ...priorById.values()]) {
    if (kept.has(v.id) && !byId.has(v.id)) byId.set(v.id, v);
  }

  const merged = [...byId.values()]
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .map((v) => {
      const text = `${v.title} ${v.captionEn ?? ""} ${v.titleFa}`;
      if (ROBOTICS_CHANNELS.has(v.channelName) || mentionsPhysicalRobot(text)) {
        return { ...v, category: "robotics" as VideoCategory };
      }
      // Demote software-bot videos the AI mislabeled robotics.
      if (v.category === "robotics") return { ...v, category: "general" as VideoCategory };
      return v;
    });

  console.log("\n[videos 3/4] Saving…");
  // Nothing fetched means nothing refreshed, so don't advance the timestamp.
  await saveVideos(merged, rawVideos.length === 0 ? prior.generatedAt : undefined);
  console.log(`      → ${merged.length} videos in data/videos.json.\n`);

  return {
    newlyEnriched: enriched.length,
    total: merged.length,
    channelsTotal: VIDEO_SOURCES.length,
    failedChannels,
    enrichAttempted: freshRaw.length,
    enrichFailed: freshRaw.length - enriched.length,
    quotaExhausted,
  };
}
