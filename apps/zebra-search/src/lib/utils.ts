export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getUrlPath(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.split('/').filter(Boolean).slice(-2).join('/');
  } catch {
    return '';
  }
}

export function getFavLetter(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')[0].toUpperCase();
  } catch {
    return '?';
  }
}

/**
 * BM25 raw scores are unbounded floats. Map them to a 0-100 display range.
 * Scores ≤ 1 are treated as already-normalized (0–1 → 0–100).
 * Larger values go through log scaling.
 */
export function normalizeScore(score: number | undefined | null): number {
  if (score === undefined || score === null) return 50;
  if (score <= 1) return Math.round(score * 100);
  return Math.min(99, Math.round(20 * Math.log(score + 1)));
}

/** Derive related queries from the search term heuristically. */
export function getRelatedQueries(query: string): string[] {
  const q = query.toLowerCase();
  if (q.includes('lru') || q.includes('cache'))
    return ['LFU cache', 'Redis eviction', 'cache invalidation', 'distributed cache', 'consistent hashing', 'write-through vs write-back'];
  if (q.includes('graph') || q.includes('bfs') || q.includes('dfs'))
    return ['topological sort', 'Dijkstra algorithm', 'Bellman-Ford', 'strongly connected components', 'minimum spanning tree', 'Floyd-Warshall'];
  if (q.includes('tree') || q.includes('trie'))
    return ['AVL tree rotations', 'Red-Black tree', 'segment tree lazy', 'binary indexed tree', 'suffix array', 'B+ tree'];
  if (q.includes('system') || q.includes('design'))
    return ['CAP theorem', 'database sharding', 'load balancing', 'message queue patterns', 'CQRS pattern', 'event sourcing'];
  return ['binary search tree', 'dynamic programming', 'graph algorithms', 'system design interview', 'hash map internals', 'B-tree vs LSM'];
}
