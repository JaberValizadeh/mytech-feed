import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProcessedArticle, Video } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(here, "..", "data", "articles.json");
const VIDEOS_FILE = join(here, "..", "data", "videos.json");

export interface ArticleStore {
  generatedAt: string;
  articles: ProcessedArticle[];
}

export interface VideoStore {
  generatedAt: string;
  videos: Video[];
}

/** Persist the processed feed to disk as JSON. */
export async function saveArticles(articles: ProcessedArticle[]): Promise<void> {
  const store: ArticleStore = {
    generatedAt: new Date().toISOString(),
    articles,
  };
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

/** Load the processed feed from disk; empty if no aggregation has run yet. */
export async function loadArticles(): Promise<ArticleStore> {
  if (!existsSync(DATA_FILE)) {
    return { generatedAt: new Date(0).toISOString(), articles: [] };
  }
  const raw = await readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as ArticleStore;
}

/** Persist the video feed to disk as JSON. */
export async function saveVideos(videos: Video[]): Promise<void> {
  const store: VideoStore = {
    generatedAt: new Date().toISOString(),
    videos,
  };
  await writeFile(VIDEOS_FILE, JSON.stringify(store, null, 2), "utf8");
}

/** Load the video feed from disk; empty if no aggregation has run yet. */
export async function loadVideos(): Promise<VideoStore> {
  if (!existsSync(VIDEOS_FILE)) {
    return { generatedAt: new Date(0).toISOString(), videos: [] };
  }
  const raw = await readFile(VIDEOS_FILE, "utf8");
  return JSON.parse(raw) as VideoStore;
}
