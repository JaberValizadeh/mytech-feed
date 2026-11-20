import assert from "node:assert/strict";
import { test } from "node:test";
import Parser from "rss-parser";
import { deduplicate } from "./dedup.js";
import { selectRetained } from "./retention.js";
import type { RawArticle } from "./types.js";
import { fingerprint, mentionsPhysicalRobot, readingMinutes, toStoredArticle } from "./util.js";
import type { ProcessedArticle } from "./types.js";
import { youtubeDescription } from "./videos.js";

const NOW = Date.parse("2026-11-07T00:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const options = { max: 5, minPerSource: 1, maxAgeDays: 30, hotMaxAgeDays: 3, now: NOW };

test("retention keeps a slow source that a newest-first cap would evict", () => {
  const busy = Array.from({ length: 20 }, (_, i) => ({
    id: `busy-${i}`,
    sourceId: "busy",
    publishedAt: hoursAgo(i),
  }));
  const slow = { id: "slow-1", sourceId: "slow", publishedAt: hoursAgo(24 * 10) };
  const kept = selectRetained([...busy, slow], options);
  assert.equal(kept.size, 5);
  assert.ok(kept.has("slow-1"));
  assert.ok(kept.has("busy-0"));
});

test("retention keeps an older hot story ahead of newer ordinary ones", () => {
  const busy = Array.from({ length: 20 }, (_, i) => ({
    id: `busy-${i}`,
    sourceId: "busy",
    publishedAt: hoursAgo(i),
  }));
  const hot = { id: "hot", sourceId: "busy", publishedAt: hoursAgo(48), sourceCount: 2 };
  assert.ok(selectRetained([...busy, hot], options).has("hot"));
});

test("retention drops stories past the age limit", () => {
  const kept = selectRetained(
    [
      { id: "ancient", sourceId: "a", publishedAt: hoursAgo(24 * 40) },
      { id: "new", sourceId: "b", publishedAt: hoursAgo(1) },
    ],
    options,
  );
  assert.deepEqual([...kept], ["new"]);
});

function raw(id: string, sourceId: string, title: string): RawArticle {
  return {
    id,
    sourceId,
    sourceName: sourceId,
    title,
    link: `https://example.com/${id}`,
    content: "",
    wordCount: 0,
    publishedAt: hoursAgo(1),
    fingerprint: fingerprint(title),
  };
}

test("the same link in two feeds is not a duplicate of itself", () => {
  const a = raw("same", "feed-a", "Meta does a U-turn on controversial terms");
  const b = raw("same", "feed-b", "Meta does a U-turn on controversial terms");
  const { unique, duplicateOf, sourceCount } = deduplicate([a, b]);
  assert.equal(unique.length, 1);
  assert.equal(duplicateOf.size, 0);
  assert.equal(sourceCount.get("same"), 1);
});

test("different links with the same story still cluster across sources", () => {
  const a = raw("one", "feed-a", "Tesla to wind down Cybertruck production");
  const b = raw("two", "feed-b", "Tesla to wind down Cybertruck production");
  const { unique, sourceCount } = deduplicate([a, b]);
  assert.equal(unique.length, 1);
  assert.equal(sourceCount.get(unique[0].id), 2);
});

test("stored articles lose source text and self-duplicate flags", () => {
  const stored = toStoredArticle({
    id: "x",
    duplicateOf: "x",
    content: "publisher text",
    fingerprint: "fp",
    wordCount: 900,
  } as unknown as ProcessedArticle) as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(stored), ["id"]);
});

test("reading time is unknown for a snippet", () => {
  assert.equal(readingMinutes(40), undefined);
  assert.equal(readingMinutes(1100), 5);
});

test("robot matching skips robots.txt but keeps real robots", () => {
  assert.equal(mentionsPhysicalRobot("Publishers update robots.txt to block crawlers"), false);
  assert.equal(mentionsPhysicalRobot("A new humanoid robot walks"), true);
  assert.equal(mentionsPhysicalRobot("Waymo robotaxi expands"), true);
});

test("the YouTube description is read from media:group", async () => {
  const parser = new Parser<Record<string, unknown>, Parser.Item>({
    customFields: { item: [["media:group", "mediaGroup"]] },
  });
  const feed = await parser.parseString(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<title>Channel</title>
<entry><title>Video</title><link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
<media:group><media:description>Real description</media:description></media:group></entry>
</feed>`);
  assert.equal(youtubeDescription(feed.items[0]), "Real description");
});
