import type Database from 'bun:sqlite';
import { Indexer } from './indexer/indexer.ts';
import { QueryEngine } from './query/query-engine.js';
import type { QueryOptions, SearchResult, IndexingResult } from './types/utils.ts';

// ============================================================
// SearchEngine — The Public API
//
// This is the façade over the indexer and query engine.
// Your crawler code, your API server, your CLI — they all
// talk to this class, never directly to Indexer or QueryEngine.
//
// Why a façade?
//   1. It enforces the correct initialization order (schema
//      creation before any queries).
//   2. It hides the fact that indexer and query engine are
//      separate components — callers don't need to know.
//   3. It's a natural seam for adding caching, metrics,
//      circuit breakers, or rate limiting later.
//
// Usage:
//   const db = new Database('crawler.db');
//   const engine = new SearchEngine(db);
//
//   // After a crawl:
//   await engine.indexNewContent();
//
//   // On a search request:
//   const results = engine.search("LRU cache implementation");
// ============================================================

export class SearchEngine {
  private indexer: Indexer;
  private queryEngine: QueryEngine;

  constructor(db: Database) {
    // Indexer constructor runs INDEX_SCHEMA_SQL — idempotent CREATE IF NOT EXISTS
    this.indexer = new Indexer(db);
    this.queryEngine = new QueryEngine(db);

    // Enable WAL mode for this database connection.
    // WAL = Write-Ahead Logging. It allows concurrent readers while
    // a writer is active. Without WAL, a write locks the entire DB
    // and your search queries would block during indexing.
    // The performance gain is significant: ~10x higher read throughput.
    db.run('PRAGMA journal_mode = WAL');

    // Increase the page cache to 64MB. SQLite's default is 2MB.
    // For an inverted index with large posting lists, this matters.
    db.run('PRAGMA cache_size = -65536'); // negative = KB; 65536KB = 64MB

    // Ensure foreign key constraints are enforced (SQLite disables by default)
    db.run('foreign_keys = ON');
  }

  /**
   * Index all articles not yet indexed.
   * Call this after each crawl cycle completes.
   */
  async indexNewContent(options: { batchSize?: number } = {}): Promise<IndexingResult> {
    return this.indexer.indexAll(options);
  }

  /**
   * Force re-index a specific article by ID.
   * Useful when article metadata (quality/authority scores) changes
   * without a content hash change.
   */
  reindexArticle(articleId: number): void {
    this.indexer.removeFromIndex(articleId);
    // The article will be picked up on the next indexAll() call.
    // To immediately re-index, mark is_indexed = 0 first.
  }

  /**
   * Execute a full-text search with ranking.
   *
   * @param query   - Natural language query string
   * @param options - Filters, weights, pagination
   *
   * Example:
   *   engine.search("consistent hashing distributed systems", {
   *     min_authority: 0.5,
   *     weights: { bm25: 0.6, quality: 0.2, authority: 0.15, freshness: 0.05 },
   *     explain: true,
   *     limit: 5
   *   })
   */
  search(query: string, options?: QueryOptions): SearchResult[] {
    return this.queryEngine.search(query, options);
  }

  /**
   * Get related query term suggestions.
   * Useful for "Did you mean?" or search autocomplete.
   */
  suggest(query: string, limit?: number): string[] {
    return this.queryEngine.suggest(query, limit);
  }

  /**
   * Health check — expose index state for monitoring.
   */
  health(): ReturnType<QueryEngine['healthCheck']> {
    return this.queryEngine.healthCheck();
  }

  /**
   * Get indexer statistics.
   */
  indexStats(): ReturnType<Indexer['getStats']> {
    return this.indexer.getStats();
  }

  /**
   * Full rebuild. Wipes the index and re-indexes everything.
   * Only use for schema migrations or tokenizer changes.
   * WARNING: Marks all articles as is_indexed = 0.
   */
  rebuildIndex(): void {
    this.indexer.rebuildIndex();
  }
}

// Re-export types so consumers don't need to import from internals
export type { QueryOptions, SearchResult, IndexingResult };
export { DEFAULT_WEIGHTS, DEFAULT_BM25_PARAMS } from './types/utils.ts';