import { MissingApiKeyError, runAggregation } from "./pipeline.js";

/**
 * Manual aggregation run: `npm run aggregate`.
 * The same pipeline runs automatically on a schedule when the API is up
 * (see scheduler.ts) — this is for one-off / first-time runs.
 */
async function main(): Promise<void> {
  try {
    const r = await runAggregation();
    console.log(
      `Done. ${r.newlyEnriched} new, ${r.reused} reused, ${r.total} total in the feed.`,
    );
    console.log("Start (or restart) the API with `npm run dev`.");
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.error(err.message);
    } else {
      console.error("Aggregation failed:", err);
    }
    process.exit(1);
  }
}

void main();
