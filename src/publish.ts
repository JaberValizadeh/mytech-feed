import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runAggregation } from "./pipeline.js";
import { runVideoAggregation } from "./videos.js";
import { loadArticles, loadSponsors, loadVideos } from "./store.js";

/**
 * Static-site build: run the full aggregation, then emit the JSON files the app
 * fetches from the CDN. Replaces the always-on Express server — GitHub Actions
 * runs this on a cron and publishes ./public to GitHub Pages.
 *
 * data/ is committed back to the repo so the next run reuses the enrichment
 * cache instead of re-paying OpenAI for every article.
 */
const OUT_DIR = join(process.cwd(), "public");

async function emit(name: string, body: unknown): Promise<void> {
  await writeFile(join(OUT_DIR, name), JSON.stringify(body), "utf8");
  console.log(`  → public/${name}`);
}

function isLiveSponsor(s: { active: boolean; startsAt?: string; endsAt?: string }): boolean {
  const now = Date.now();
  if (!s.active) return false;
  if (s.startsAt && now < new Date(s.startsAt).getTime()) return false;
  if (s.endsAt && now > new Date(s.endsAt).getTime()) return false;
  return true;
}

const TZ = "Australia/Sydney";

/**
 * Refresh when the stored feed is at least this old. GitHub cron regularly
 * fires minutes-to-hours late, so matching the exact Sydney hour misses runs
 * (it did: two skipped slots on 12–13 Jul). A staleness gate is delay-proof:
 * whichever cron eventually fires, it refreshes iff a ~12h window has passed.
 * The workflow's concurrency group stops back-to-back crons from doubling up.
 */
const MIN_AGE_HOURS = Number(process.env.MIN_REFRESH_AGE_HOURS ?? 11);

async function shouldRunNow(): Promise<boolean> {
  if (process.env.FORCE === "1") return true;
  const { generatedAt, articles } = await loadArticles();
  if (articles.length === 0) return true;
  const ageHours = (Date.now() - new Date(generatedAt).getTime()) / 3_600_000;
  console.log(`Feed age: ${ageHours.toFixed(1)}h (refresh at >= ${MIN_AGE_HOURS}h).`);
  return ageHours >= MIN_AGE_HOURS;
}

async function main(): Promise<void> {
  // Gate only the expensive aggregation. The static files are always re-emitted
  // so the Pages deploy step has something to publish on every run.
  if (await shouldRunNow()) {
    await runAggregation();
    await runVideoAggregation();
  } else {
    const now = new Date().toLocaleString("en-AU", { timeZone: TZ });
    console.log(`Feed still fresh (${now} Sydney). Re-publishing existing data.`);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const { articles, generatedAt } = await loadArticles();
  const { videos, generatedAt: videosAt } = await loadVideos();
  const sponsors = await loadSponsors();

  // The app filters/paginates client-side, so ship the whole (deduped) feed.
  const feed = articles.filter((a) => !a.duplicateOf);
  await emit("feed.json", { generatedAt, count: feed.length, articles: feed });

  await emit("videos.json", { generatedAt: videosAt, count: videos.length, videos });

  const hot = feed
    .filter((a) => (a.sourceCount ?? 1) >= 2)
    .sort(
      (a, b) =>
        (b.sourceCount ?? 1) - (a.sourceCount ?? 1) ||
        +new Date(b.publishedAt) - +new Date(a.publishedAt),
    )
    .slice(0, 20);
  await emit("trending.json", { count: hot.length, articles: hot });

  // Ship every sponsor and let the app evaluate active/startsAt/endsAt at
  // runtime. Filtering here would freeze flight windows to build time, so an
  // ad that expires between builds would keep running for hours.
  const live = sponsors.filter(isLiveSponsor);
  const all = [...sponsors].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  await emit("sponsors.json", { count: all.length, sponsors: all });

  await writeFile(
    join(OUT_DIR, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>MyTech feed</title>
<h1>MyTech static feed</h1>
<p>Updated ${generatedAt}</p>
<ul>
<li><a href="feed.json">feed.json</a> — ${feed.length} articles</li>
<li><a href="videos.json">videos.json</a> — ${videos.length} videos</li>
<li><a href="trending.json">trending.json</a> — ${hot.length} hot</li>
<li><a href="sponsors.json">sponsors.json</a> — ${live.length} sponsors</li>
</ul>`,
    "utf8",
  );

  console.log(
    `\nPublished: ${feed.length} articles, ${videos.length} videos, ${hot.length} hot, ${live.length} sponsors.`,
  );
}

main().catch((err) => {
  console.error("publish failed:", err);
  process.exit(1);
});
