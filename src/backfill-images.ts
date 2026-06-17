/**
 * One-time script: fetches og:image for all stored articles that don't have one.
 * Run with: npx tsx src/backfill-images.ts
 */
import { loadArticles, saveArticles } from "./store.js";
import { fetchOgImage } from "./util.js";

const CONCURRENCY = 10;

const { articles } = await loadArticles();
const missing = articles.filter((a) => !a.imageUrl);
console.log(`Backfilling images for ${missing.length}/${articles.length} articles…`);

let done = 0;
let index = 0;

async function worker(): Promise<void> {
  while (index < missing.length) {
    const article = missing[index++];
    const url = await fetchOgImage(article.link);
    if (url) {
      article.imageUrl = url;
      done++;
    }
    process.stdout.write(`\r  ${index}/${missing.length} fetched, ${done} with images`);
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker));
console.log(`\nDone. ${done} images added.`);
await saveArticles(articles);
console.log("Saved.");
