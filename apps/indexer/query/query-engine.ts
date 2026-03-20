import type Database from 'bun:sqlite';
import type {
  QueryOptions,
  SearchResult,
  ScoreBreakdown,
} from '../types/utils.ts';
import { DEFAULT_WEIGHTS, DEFAULT_BM25_PARAMS } from '../types/utils.ts';
import { textProcessor } from '../shared/text-processor.ts';
import { BM25Scorer } from './bm25.ts';
import { ScoreNormalizer, type RawCandidateScore } from './normalizer.ts';

// ============================================================
// Query Engine
//
// Executes a search query against the inverted index and
// returns ranked results with score breakdowns.
//
// Query execution pipeline:
//
//   1. Tokenize query (same pipeline as indexer — critical)
//   2. Fetch corpus stats (avgdl, N) from index_metadata
//   3. For each query term, fetch its posting list
//      (docId, tf, title_tf, content_tf, doc_freq)
//   4. Merge posting lists — accumulate BM25 per (term, doc) pair
//   5. Join with articles table for quality/authority/freshness
//   6. Apply filters (min_quality, min_authority, date_after)
//   7. Normalize BM25 scores within result set
//   8. Fuse signals with weights
//   9. Sort descending by final score
//  10. Slice to limit/offset, extract snippets
//
// This is a "late merge" strategy: we score per term, then
// merge scores by document. The alternative (early merge via
// intersection) is faster for high-selectivity queries but
// misses documents that match some but not all terms. For a
// DSA search engine where queries are often 2-3 words, late
// merge (OR semantics with ranking) gives better recall.
//
// Performance characteristics:
//   For a corpus of 10k docs with a vocabulary of ~50k terms,
//   each query term's posting list has ~100-200 entries on average.
//   With 3 query terms, you're merging ~600 postings — trivially
//   fast in memory. SQLite will retrieve these with a single
//   index scan per term.
//
// When to worry about performance:
//   Short common terms ("tree", "graph") may have posting lists
//   of thousands of entries. BM25's IDF will naturally down-weight
//   these, but they still take time to fetch and merge.
//   If query latency becomes an issue, add a max_postings_per_term
//   limit (take the top-N by TF). This is what early web search
//   engines did (it's called "index pruning").
// ============================================================
