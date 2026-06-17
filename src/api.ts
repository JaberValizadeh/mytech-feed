import "dotenv/config";
import cors from "cors";
import express from "express";
import { loadArticles, loadVideos } from "./store.js";
import { startAutoRefresh, triggerRefresh } from "./scheduler.js";
import { SOURCES } from "./sources.js";
import { CATEGORY_IDS } from "./types.js";
import type { ProcessedArticle } from "./types.js";

const app = express();
app.use(cors());

const PORT = Number(process.env.PORT ?? 4000);

/** Health check. */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/** List sources we aggregate. */
app.get("/sources", (_req, res) => {
  res.json(SOURCES.map(({ id, name, homepage }) => ({ id, name, homepage })));
});

/** Available categories (ids; Persian labels live in the app). */
app.get("/categories", (_req, res) => {
  res.json(CATEGORY_IDS);
});

/**
 * The main feed. Query params:
 *   category          — filter to one category id
 *   source            — filter to one source id
 *   q                 — free-text search across Persian title/summary/tags
 *   limit             — page size (default 50, max 500)
 *   offset            — pagination offset (default 0)
 *   includeDuplicates — pass 1 to include duplicate stories
 * Response includes `count` (total matching) so clients know when to stop paginating.
 */
app.get("/feed", async (req, res) => {
  const { articles, generatedAt } = await loadArticles();
  const { category, source, q, limit, offset, includeDuplicates } = req.query;

  let result: ProcessedArticle[] = articles;

  if (includeDuplicates !== "1") {
    result = result.filter((a) => !a.duplicateOf);
  }
  if (typeof category === "string") {
    result = result.filter((a) => a.category === category);
  }
  if (typeof source === "string") {
    result = result.filter((a) => a.sourceId === source);
  }
  if (typeof q === "string" && q.trim()) {
    const needle = q.trim().toLowerCase();
    result = result.filter((a) =>
      [a.titleFa, a.summaryFa, ...a.tagsFa].join(" ").toLowerCase().includes(needle),
    );
  }

  const max = Math.min(Number(limit ?? 50), 500);
  const off = Math.max(Number(offset ?? 0), 0);
  res.json({ generatedAt, count: result.length, articles: result.slice(off, off + max) });
});

/** A single article by id. */
app.get("/articles/:id", async (req, res) => {
  const { articles } = await loadArticles();
  const article = articles.find((a) => a.id === req.params.id);
  if (!article) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(article);
});

/**
 * Video feed. Query params:
 *   category — filter to one VideoCategory
 *   limit    — page size (default 50, max 200)
 *   offset   — pagination offset (default 0)
 */
app.get("/videos", async (req, res) => {
  const { videos, generatedAt } = await loadVideos();
  const { category, limit, offset } = req.query;

  let result = videos;
  if (typeof category === "string") {
    result = result.filter((v) => v.category === category);
  }

  const max = Math.min(Number(limit ?? 50), 200);
  const off = Math.max(Number(offset ?? 0), 0);
  res.json({ generatedAt, count: result.length, videos: result.slice(off, off + max) });
});

/**
 * Force an immediate refresh of articles + videos. Guarded by a shared secret:
 * send header `x-admin-token` matching the ADMIN_TOKEN env var. Returns 202 once
 * the refresh has started (it runs in the background and takes a few minutes).
 */
app.post("/admin/refresh", (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.get("x-admin-token") !== token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const started = triggerRefresh("manual: admin endpoint");
  res
    .status(started ? 202 : 409)
    .json({ started, message: started ? "refresh started" : "a refresh is already in progress" });
});

app.listen(PORT, () => {
  console.log(`TechNews Persian API listening on http://localhost:${PORT}`);
  console.log(`Feed:        http://localhost:${PORT}/feed`);
  console.log(`On a phone, use your machine's LAN IP instead of localhost.`);
  // Fetch fresh news on boot (if stale) and keep it refreshed on a schedule.
  void startAutoRefresh();
});
