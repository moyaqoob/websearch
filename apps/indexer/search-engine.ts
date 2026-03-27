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
    this.indexer = new Indexer(db);
    this.queryEngine = new QueryEngine(db);

    db.run('PRAGMA journal_mode = WAL');

    db.run('PRAGMA cache_size = -65536'); // negative = KB; 65536KB = 64MB

    db.run('foreign_keys = ON');
  }

  async indexNewContent(options: { batchSize?: number } = {}): Promise<IndexingResult> {
    return this.indexer.indexAll(options);
  }

  
  reindexArticle(articleId: string): void {
    this.indexer.removeFromIndex(articleId)
  }
 
  search(query: string, options?: QueryOptions): SearchResult[] {
    return this.queryEngine.search(query, options);
  }

  suggest(query: string, limit?: number): string[] {
    return this.queryEngine.suggest(query, limit);
  }

  health(): ReturnType<QueryEngine['healthCheck']> {
    return this.queryEngine.healthCheck();
  }

  indexStats(): ReturnType<Indexer['getStats']> {
    return this.indexer.getStats();
  }


  rebuildIndex(): void {
    this.indexer.rebuildIndex();
  }
}

export type { QueryOptions, SearchResult, IndexingResult };
export { DEFAULT_WEIGHTS, DEFAULT_BM25_PARAMS } from './types/utils.ts';