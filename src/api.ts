import "dotenv/config";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { loadArticles, loadSponsors, loadVideos, saveSponsors } from "./store.js";
import { startAutoRefresh, triggerRefresh } from "./scheduler.js";
import { SOURCES } from "./sources.js";
import { CATEGORY_IDS } from "./types.js";
import type { ProcessedArticle, Sponsor } from "./types.js";
import { articleBidi, sponsorBidi, videoBidi } from "./util.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const PORT = Number(process.env.PORT ?? 4000);

/** Guard for owner-only endpoints: requires the x-admin-token shared secret. */
function requireAdmin(req: express.Request, res: express.Response): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.get("x-admin-token") !== token) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

/** True if the sponsor is on and within its (optional) flight window. */
function sponsorIsLive(s: Sponsor, now = Date.now()): boolean {
  if (!s.active) return false;
  if (s.startsAt && now < new Date(s.startsAt).getTime()) return false;
  if (s.endsAt && now > new Date(s.endsAt).getTime()) return false;
  return true;
}

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
      [a.titleFa, a.summaryFa, a.title, a.summaryEn ?? "", ...a.tagsFa]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }

  const max = Math.min(Number(limit ?? 50), 500);
  const off = Math.max(Number(offset ?? 0), 0);
  res.json({
    generatedAt,
    count: result.length,
    articles: result.slice(off, off + max).map(articleBidi),
  });
});

/**
 * Hot news: stories carried by 2+ sources (>= 60% content similarity, clustered
 * during dedup). Sorted by how many sources covered it, then recency.
 */
app.get("/trending", async (_req, res) => {
  const { articles } = await loadArticles();
  const hot = articles
    .filter((a) => !a.duplicateOf && (a.sourceCount ?? 1) >= 2)
    .sort(
      (a, b) =>
        (b.sourceCount ?? 1) - (a.sourceCount ?? 1) ||
        +new Date(b.publishedAt) - +new Date(a.publishedAt),
    )
    .slice(0, 20);
  res.json({ count: hot.length, articles: hot.map(articleBidi) });
});

/** A single article by id. */
app.get("/articles/:id", async (req, res) => {
  const { articles } = await loadArticles();
  const article = articles.find((a) => a.id === req.params.id);
  if (!article) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(articleBidi(article));
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
  res.json({
    generatedAt,
    count: result.length,
    videos: result.slice(off, off + max).map(videoBidi),
  });
});

/**
 * Force an immediate refresh of articles + videos. Guarded by a shared secret:
 * send header `x-admin-token` matching the ADMIN_TOKEN env var. Returns 202 once
 * the refresh has started (it runs in the background and takes a few minutes).
 */
app.post("/admin/refresh", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const started = triggerRefresh("manual: admin endpoint");
  res
    .status(started ? 202 : 409)
    .json({ started, message: started ? "refresh started" : "a refresh is already in progress" });
});

/**
 * Public: live sponsored posts (active + within flight window), newest first.
 * The app interleaves these into the feed as labeled native ad cards.
 */
app.get("/sponsors", async (_req, res) => {
  const sponsors = await loadSponsors();
  const live = sponsors
    .filter((s) => sponsorIsLive(s))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  res.json({ count: live.length, sponsors: live.map(sponsorBidi) });
});

/** Owner: list all sponsored posts, including inactive/expired ones. */
app.get("/admin/sponsors", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ sponsors: await loadSponsors() });
});

/**
 * Owner: create a sponsored post. Body fields: advertiser, titleFa, titleEn,
 * bodyFa, bodyEn, ctaUrl (required); imageUrl, ctaTextFa, ctaTextEn, active
 * (default true), startsAt, endsAt (optional). Returns the created sponsor.
 */
app.post("/admin/sponsors", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const b = req.body ?? {};
  const required = ["advertiser", "titleFa", "titleEn", "bodyFa", "bodyEn", "ctaUrl"] as const;
  const missing = required.filter((k) => typeof b[k] !== "string" || !b[k].trim());
  if (missing.length) {
    res.status(400).json({ error: "missing_fields", fields: missing });
    return;
  }
  const sponsor: Sponsor = {
    id: typeof b.id === "string" && b.id.trim() ? b.id.trim() : randomUUID(),
    advertiser: b.advertiser.trim(),
    titleFa: b.titleFa.trim(),
    titleEn: b.titleEn.trim(),
    bodyFa: b.bodyFa.trim(),
    bodyEn: b.bodyEn.trim(),
    imageUrl: typeof b.imageUrl === "string" && b.imageUrl.trim() ? b.imageUrl.trim() : undefined,
    ctaUrl: b.ctaUrl.trim(),
    ctaTextFa: typeof b.ctaTextFa === "string" ? b.ctaTextFa.trim() : undefined,
    ctaTextEn: typeof b.ctaTextEn === "string" ? b.ctaTextEn.trim() : undefined,
    active: b.active !== false,
    startsAt: typeof b.startsAt === "string" ? b.startsAt : undefined,
    endsAt: typeof b.endsAt === "string" ? b.endsAt : undefined,
    createdAt: new Date().toISOString(),
  };
  const sponsors = await loadSponsors();
  // Upsert by id so re-posting the same id edits in place.
  const next = [sponsor, ...sponsors.filter((s) => s.id !== sponsor.id)];
  await saveSponsors(next);
  res.status(201).json(sponsor);
});

/** Owner: delete a sponsored post by id. */
app.delete("/admin/sponsors/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const sponsors = await loadSponsors();
  const next = sponsors.filter((s) => s.id !== req.params.id);
  if (next.length === sponsors.length) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  await saveSponsors(next);
  res.json({ deleted: req.params.id });
});

app.listen(PORT, () => {
  console.log(`TechNews Persian API listening on http://localhost:${PORT}`);
  console.log(`Feed:        http://localhost:${PORT}/feed`);
  console.log(`On a phone, use your machine's LAN IP instead of localhost.`);
  // Fetch fresh news on boot (if stale) and keep it refreshed on a schedule.
  void startAutoRefresh();
});
