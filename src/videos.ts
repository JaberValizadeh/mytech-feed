import "dotenv/config";
import Parser from "rss-parser";
import OpenAI from "openai";
import type { Video, VideoCategory } from "./types.js";
import { VIDEO_SOURCES } from "./videoSources.js";
import { loadVideos, saveVideos } from "./store.js";
import { mentionsPhysicalRobot, truncate } from "./util.js";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_STORED_VIDEOS = Number(process.env.MAX_STORED_VIDEOS ?? 150);
const MAX_VIDEOS_PER_CHANNEL = Number(process.env.MAX_VIDEOS_PER_CHANNEL ?? 5);

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
  if (!_client) _client = new OpenAI({ maxRetries: 8 });
  return _client;
}

type YtItem = Parser.Item & { ytVideoId?: string };

const parser = new Parser<Record<string, unknown>, YtItem>({
  timeout: 15000,
  headers: { "User-Agent": "TechNewsPersian/1.0 (+aggregator)" },
  customFields: {
    item: [["yt:videoId", "ytVideoId"]],
  },
});

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
- captionFa را فقط به فارسی بنویس.`;

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
  const feed = await parser.parseURL(feedUrl);
  const items = (feed.items ?? []).slice(0, MAX_VIDEOS_PER_CHANNEL);

  return items
    .map((item): RawVideo | null => {
      const link = item.link?.trim();
      const title = item.title?.trim();
      if (!link || !title) return null;

      const videoId = item.ytVideoId ?? extractVideoId(link);
      if (!videoId) return null;

      const description = item.contentSnippet?.trim() ?? "";
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

/**
 * Full video aggregation cycle:
 *   fetch YouTube RSS feeds → skip known → AI-enrich new → merge rolling store.
 */
export async function runVideoAggregation(): Promise<{ newlyEnriched: number; total: number }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[videos] OPENAI_API_KEY not set — skipping video enrichment.");
    return { newlyEnriched: 0, total: 0 };
  }

  console.log(`\n[videos 1/4] Fetching ${VIDEO_SOURCES.length} YouTube channels…`);
  const rawResults = await Promise.allSettled(
    VIDEO_SOURCES.map((src) =>
      fetchChannel(src.channelId, src.name, src.defaultCategory),
    ),
  );

  const rawVideos: RawVideo[] = [];
  rawResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      rawVideos.push(...result.value);
      console.log(`  ✓ ${VIDEO_SOURCES[i].name}: ${result.value.length} videos`);
    } else {
      console.warn(`  ✗ ${VIDEO_SOURCES[i].name}: ${String(result.reason).slice(0, 120)}`);
    }
  });
  console.log(`      → ${rawVideos.length} videos fetched.`);

  const prior = await loadVideos();
  const existingIds = new Set(prior.videos.map((v) => v.id));
  const freshRaw = rawVideos.filter((v) => !existingIds.has(v.id));
  console.log(
    `\n[videos 2/4] AI enrichment — ${freshRaw.length} new, ${rawVideos.length - freshRaw.length} reused…`,
  );

  const concurrency = Number(process.env.AI_CONCURRENCY ?? 2);
  const enriched: Video[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < freshRaw.length) {
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
        });
        console.log(`  ✓ [${n}/${freshRaw.length}] ${e.titleFa}`);
      } catch (err) {
        console.warn(
          `  ✗ [${n}/${freshRaw.length}] ${raw.title}: ${String(err).slice(0, 120)}`,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, freshRaw.length || 1) }, worker),
  );

  // Reuse prior videos for IDs that appear in this run (refresh is no-op, but keeps them current).
  const reused = prior.videos.filter((v) =>
    rawVideos.some((r) => r.id === v.id),
  );

  const byId = new Map<string, Video>();
  for (const v of [...enriched, ...reused, ...prior.videos]) {
    if (!byId.has(v.id)) byId.set(v.id, v);
  }
  const merged = [...byId.values()]
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, MAX_STORED_VIDEOS)
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
  await saveVideos(merged);
  console.log(`      → ${merged.length} videos in data/videos.json.\n`);

  return { newlyEnriched: enriched.length, total: merged.length };
}
