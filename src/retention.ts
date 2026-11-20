/**
 * Decides which stories stay in a rolling store. Runs BEFORE AI enrichment, so a
 * story that would be evicted anyway is never paid for, and a story that is kept
 * stays cached, so it is never paid for twice.
 */
export interface RetentionCandidate {
  id: string;
  sourceId: string;
  publishedAt: string;
  sourceCount?: number;
}

export interface RetentionOptions {
  /** Total stories to keep. */
  max: number;
  /** Newest stories guaranteed to every source, so slow blogs aren't crowded out. */
  minPerSource: number;
  /** Anything older is dropped, whatever its source. */
  maxAgeDays: number;
  /** Multi-source ("hot") stories newer than this are always kept. */
  hotMaxAgeDays: number;
  now?: number;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Fill order: recent hot stories (their canonical copy is the OLDEST report, so a
 * plain newest-first cap evicts exactly these), then each source's newest few,
 * then whatever is newest overall.
 */
export function selectRetained(
  candidates: RetentionCandidate[],
  options: RetentionOptions,
): Set<string> {
  const now = options.now ?? Date.now();
  const time = (c: RetentionCandidate) => new Date(c.publishedAt).getTime();
  const newestFirst = candidates
    .filter((c) => now - time(c) <= options.maxAgeDays * DAY_MS)
    .sort((a, b) => time(b) - time(a));

  const kept = new Set<string>();
  const perSource = new Map<string, number>();
  const keep = (c: RetentionCandidate) => {
    if (kept.has(c.id) || kept.size >= options.max) return;
    kept.add(c.id);
    perSource.set(c.sourceId, (perSource.get(c.sourceId) ?? 0) + 1);
  };

  for (const c of newestFirst) {
    const hot = (c.sourceCount ?? 1) >= 2;
    if (hot && now - time(c) <= options.hotMaxAgeDays * DAY_MS) keep(c);
  }
  for (const c of newestFirst) {
    if ((perSource.get(c.sourceId) ?? 0) < options.minPerSource) keep(c);
  }
  for (const c of newestFirst) keep(c);

  return kept;
}
