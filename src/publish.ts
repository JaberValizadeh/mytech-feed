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
const RUN_HOURS = [6, 18]; // 6 AM / 6 PM Sydney

/**
 * GitHub cron is UTC-only and cannot follow Sydney DST, so the workflow fires
 * four UTC crons that bracket both targets year-round; this gate lets exactly
 * the two correct ones through. FORCE=1 (workflow_dispatch) bypasses it.
 */
function shouldRunNow(): boolean {
  if (process.env.FORCE === "1") return true;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  return RUN_HOURS.includes(hour);
}

async function main(): Promise<void> {
  // Gate only the expensive aggregation. The static files are always re-emitted
  // so the Pages deploy step has something to publish on every run.
  if (shouldRunNow()) {
    await runAggregation();
    await runVideoAggregation();
  } else {
    const now = new Date().toLocaleString("en-AU", { timeZone: TZ });
    console.log(`Not a scheduled slot (${now} Sydney; want 6 AM / 6 PM). Re-publishing existing data.`);
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
