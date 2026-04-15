import { QueryEngine } from './query/query-engine.js';
import type { QueryOptions, SearchResult, IndexingResult } from './types/utils.ts';
import {D1Client} from './indexer/client.ts';


export class SearchEngine {
  private queryEngine: QueryEngine;
  constructor() {
    this.queryEngine = new QueryEngine()
  }

  search(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.queryEngine.search(query, options);
  }

  suggest(query: string, limit?: number): Promise<string[]> {
    return this.queryEngine.suggest(query, limit);
  }
}

export type { QueryOptions, SearchResult, IndexingResult };
export { DEFAULT_WEIGHTS, DEFAULT_BM25_PARAMS } from './types/utils.ts';
