// ============================================================
// Core Domain Types
// These mirror your Articles table schema exactly.
// ============================================================

// What gets read from the DB (articles JOIN signals)
export interface IndexedArticle {
  id: string;
  url: string;
  url_normalized: string;
  domain: string;
  title: string;
  content: string;
  is_indexed: number;
  crawl_timestamp: string;
  published_date: string | null;
  content_hash: string;
}

export interface IndexedSignal {
  article_id: string;
  quality_score: number;
  readability_score: number;
  authority_score: number;
  freshness_score: number;
  popularity_score: number;
}

export interface CorpusStats {
  total_documents: number;
  avg_document_length: number;
}

export interface PostingRow {
  doc_id: number;
  term_frequency: number;
  title_tf: number;
  content_tf: number;
  doc_freq: number;
  doc_length: number;
}

export interface ArticleRow {
  id: number;
  url: string;
  title: string;
  content: string;
  author: string | null;
  published_date: string | null;
  quality_score: number;
  authority_score: number;
  freshness_score: number;
}
export interface Posting {
  doc_id: number;
  term_frequency: number;
  positions: number[];
  field_weights: FieldWeights;
}

export interface FieldWeights {
  title_tf: number;
  content_tf: number;
}

export interface IndexMetadata {
  total_documents: number;
  avg_document_length: number; // average token count across all docs
  total_terms: number; // vocabulary size
  last_updated: string; // ISO timestamp
  index_version: number; // bump on schema changes
}

// ============================================================
// Query Types
// ============================================================

export interface QueryOptions {
  limit?: number; // default: 10
  offset?: number; // for pagination
  min_quality?: number; // filter: quality_score >= min_quality
  min_authority?: number; // filter: authority_score >= min_authority
  date_after?: string; // ISO date string filter
  weights?: RankingWeights; // override default signal weights
  explain?: boolean; // include per-signal score breakdown
}

export interface RankingWeights {
  bm25: number;
  quality: number;
  authority: number;
  freshness: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  bm25: 0.55,
  quality: 0.2,
  authority: 0.15,
  freshness: 0.1,
};

export interface BM25Params {
  k1: number; // default: 1.5
  b: number; // default: 0.75
}

export const DEFAULT_BM25_PARAMS: BM25Params = {
  k1: 1.5,
  b: 0.75,
};

// ============================================================
// Query Result Types
// ============================================================

export interface SearchResult {
  article_id: number;
  url: string;
  title: string;
  snippet: string; // extracted text snippet around query terms
  published_date: string | null;
  scores: ScoreBreakdown;
  final_score: number; // composite normalized score
}

export interface ScoreBreakdown {
  bm25_raw: number;
  bm25_normalized: number;
  quality_score: number;
  authority_score: number;
  freshness_score: number;
  final: number;
}

// ============================================================
// Indexer Operation Types
// ============================================================

export interface IndexingResult {
  articles_processed: number;
  articles_indexed: number;
  articles_skipped: number; // already indexed, content hash unchanged
  errors: IndexingError[];
  duration_ms: number;
}

export interface IndexingError {
  article_id: string;
  url: string;
  error: string;
}

export interface TokenizedDocument {
  doc_id: number;
  doc_length: number; // total token count (content + title)
  tokens: TokenWithMetadata[];
}

export interface TokenWithMetadata {
  term: string; // normalized, stemmed token
  position: number; // position in document token stream
  field: "title" | "content"; // which field it came from
}
