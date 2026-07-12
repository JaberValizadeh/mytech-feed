import { loadArticles, loadVideos } from "./store.js";
import { MissingApiKeyError, runAggregation } from "./pipeline.js";
import { runVideoAggregation } from "./videos.js";

const TZ = "Australia/Sydney";
// Must stay ascending: nextRunDate() picks the first hour greater than "now".
const DAILY_HOURS = [6, 18]; // 6 AM and 6 PM Sydney time

let running = false;

async function refresh(reason: string): Promise<void> {
  if (running) {
    console.log(`[scheduler] skip (${reason}): a refresh is already in progress.`);
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    console.log(`[scheduler] refresh started (${reason}).`);
    const r = await runAggregation();
    const secs = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `[scheduler] articles done in ${secs}s — ${r.newlyEnriched} new, ${r.total} total.`,
    );
    const vr = await runVideoAggregation();
    const totalSecs = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `[scheduler] videos done — ${vr.newlyEnriched} new, ${vr.total} total. Full refresh in ${totalSecs}s.`,
    );
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.warn(
        `[scheduler] ${err.message}\n` +
          `[scheduler] Auto-refresh paused until a key is set; serving existing data.`,
      );
    } else {
      console.error("[scheduler] refresh failed:", err);
    }
  } finally {
    running = false;
  }
}

/**
 * Kick off a refresh on demand (e.g. from the admin endpoint). Fire-and-forget:
 * aggregation takes minutes, so we return immediately and let it run in the
 * background. Returns false if a refresh is already in progress.
 */
export function triggerRefresh(reason: string): boolean {
  if (running) return false;
  void refresh(reason);
  return true;
}

function sydneyDateParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);
  return {
    year: g("year"),
    month: g("month"),
    day: g("day"),
    hour: g("hour"),
    minute: g("minute"),
    second: g("second"),
  };
}

function sydneyHourOf(d: Date): number {
  return parseInt(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(d),
  );
}

/** Returns the UTC Date of the next scheduled run (6 AM or 6 PM Sydney). */
function nextRunDate(): Date {
  const now = new Date();
  const p = sydneyDateParts(now);
  const nowH = p.hour + p.minute / 60 + p.second / 3600;

  // Pick the next target hour: either later today or 6 AM tomorrow
  let targetH = DAILY_HOURS.find((h) => h > nowH);
  let base = { year: p.year, month: p.month, day: p.day };

  if (targetH === undefined) {
    targetH = DAILY_HOURS[0]; // 6 AM
    // Advance by 24 h to land in Sydney's tomorrow
    const tp = sydneyDateParts(new Date(now.getTime() + 24 * 3600 * 1000));
    base = { year: tp.year, month: tp.month, day: tp.day };
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${base.year}-${pad(base.month)}-${pad(base.day)}T${pad(targetH)}:00:00`;

  // Try AEST (UTC+10) then AEDT (UTC+11) to handle DST transparently
  for (const offset of [10, 11]) {
    const candidate = new Date(`${dateStr}+${pad(offset)}:00`);
    if (sydneyHourOf(candidate) === targetH) return candidate;
  }

  // Fallback: AEST
  return new Date(`${dateStr}+10:00`);
}

function scheduleNext(): void {
  const next = nextRunDate();
  const ms = next.getTime() - Date.now();
  const label = next.toLocaleString("en-AU", { timeZone: TZ });
  console.log(`[scheduler] next run at ${label} Sydney (in ${Math.round(ms / 60000)} min)`);
  const timer = setTimeout(async () => {
    await refresh("scheduled: 6AM/6PM Sydney");
    scheduleNext();
  }, ms);
  timer.unref?.();
}

/** True if articles are missing or older than 13 h (just over the 12 h window). */
async function articlesStale(): Promise<boolean> {
  const { generatedAt, articles } = await loadArticles();
  if (articles.length === 0) return true;
  return Date.now() - new Date(generatedAt).getTime() >= 13 * 3600 * 1000;
}

/** True if the video store has never been populated. */
async function videosMissing(): Promise<boolean> {
  const { videos } = await loadVideos();
  return videos.length === 0;
}

/**
 * Refresh at 6 AM and 6 PM Australia/Sydney every day.
 * On boot, refreshes articles if stale and always seeds videos if the store is empty.
 */
export async function startAutoRefresh(): Promise<void> {
  if (process.env.AUTO_REFRESH === "0") {
    console.log("[scheduler] AUTO_REFRESH=0 — automatic refresh disabled.");
    return;
  }

  console.log(`[scheduler] scheduled at 6 AM and 6 PM ${TZ}.`);

  const stale = await articlesStale();
  const noVideos = await videosMissing();

  if (stale) {
    // Full refresh — articles + videos both run inside refresh().
    void refresh("startup: feed missing or stale");
  } else if (noVideos) {
    // Articles are fresh but videos have never been seeded — run just the video pipeline.
    console.log("[scheduler] articles fresh but no videos yet — seeding video store…");
    void runVideoAggregation().then(({ newlyEnriched, total }) => {
      console.log(`[scheduler] video seed done — ${newlyEnriched} enriched, ${total} total.`);
    }).catch((err) => {
      console.error("[scheduler] video seed failed:", err);
    });
  } else {
    console.log("[scheduler] feeds are still fresh; next run on schedule.");
  }

  scheduleNext();
}
