import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProcessedArticle, Sponsor, Video } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
// Where the JSON store lives. On Railway, set DATA_DIR=/data (the mounted
// persistent volume) so the feed survives restarts/redeploys; locally it
// falls back to ./data next to the source.
const DATA_DIR = process.env.DATA_DIR ?? join(here, "..", "data");
const DATA_FILE = join(DATA_DIR, "articles.json");
const VIDEOS_FILE = join(DATA_DIR, "videos.json");
const SPONSORS_FILE = join(DATA_DIR, "sponsors.json");

/** Ensure the data directory exists before writing (it may be an empty volume). */
async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

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
  await ensureDataDir();
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
  await ensureDataDir();
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

/** Load all sponsored posts (including inactive); empty if none configured. */
export async function loadSponsors(): Promise<Sponsor[]> {
  if (!existsSync(SPONSORS_FILE)) return [];
  const raw = await readFile(SPONSORS_FILE, "utf8");
  return JSON.parse(raw) as Sponsor[];
}

/** Persist the full list of sponsored posts. */
export async function saveSponsors(sponsors: Sponsor[]): Promise<void> {
  await ensureDataDir();
  await writeFile(SPONSORS_FILE, JSON.stringify(sponsors, null, 2), "utf8");
}
