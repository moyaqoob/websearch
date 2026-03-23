// ============================================================
// Core Domain Types
// These mirror your Articles table schema exactly.
// ============================================================

export interface Article {
    id: number;
    url: string;
    title: string;
    content: string;
    author: string | null;
    published_date: string | null;
    quality_score: number;       // [0, 1] — content signal quality
    authority_score: number;     // [0, 1] — domain/source authority
    freshness_score: number;     // [0, 1] — recency signal
    content_hash: string;
    is_indexed: number;          // SQLite boolean (0 or 1)
    s3_snippet_key: string | null;
    embedding_vector_json: string | null;
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
  // ============================================================
  // Inverted Index Types
  // The posting list is the fundamental data structure.
  // Each term maps to a list of postings — one per document
  // that contains the term, with frequency and positions.
  //
  // Why store positions? Phrase queries ("binary search" as
  // a phrase, not "binary" AND "search" anywhere). Adding
  // positions now costs a small amount of storage; adding
  // them later costs a full reindex.
  // ============================================================
  
  export interface Posting {
    doc_id: number;
    term_frequency: number;        // raw tf in this document
    positions: number[];           // token positions (for phrase queries)
    field_weights: FieldWeights;   // per-field contribution
  }
  
  export interface FieldWeights {
    title_tf: number;              // occurrences in title (weighted 3x)
    content_tf: number;            // occurrences in content (weighted 1x)
  }
  
  // ============================================================
  // Index Metadata — corpus-level statistics
  // BM25 requires these; they must be computed over the
  // full corpus, not estimated or hardcoded.
  // ============================================================
  
  export interface IndexMetadata {
    total_documents: number;
    avg_document_length: number;   // average token count across all docs
    total_terms: number;           // vocabulary size
    last_updated: string;          // ISO timestamp
    index_version: number;         // bump on schema changes
  }
  
  // ============================================================
  // Query Types
  // ============================================================
  
  export interface QueryOptions {
    limit?: number;                // default: 10
    offset?: number;               // for pagination
    min_quality?: number;          // filter: quality_score >= min_quality
    min_authority?: number;        // filter: authority_score >= min_authority
    date_after?: string;           // ISO date string filter
    weights?: RankingWeights;      // override default signal weights
    explain?: boolean;             // include per-signal score breakdown
  }
  
  export interface RankingWeights {
    bm25: number;          // text relevance signal weight
    quality: number;       // content quality signal weight
    authority: number;     // source authority signal weight
    freshness: number;     // recency signal weight
  }
  
  export const DEFAULT_WEIGHTS: RankingWeights = {
    bm25: 0.55,
    quality: 0.20,
    authority: 0.15,
    freshness: 0.10,
  };
  
  // BM25 hyperparameters. These are empirically tuned defaults.
  // k1 controls term frequency saturation — higher = slower saturation.
  // b controls document length normalization — 1.0 = full normalization.
  // For DSA/SysDesign content (long-form articles), these are good starting points.
  export interface BM25Params {
    k1: number;   // default: 1.5
    b: number;    // default: 0.75
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
    snippet: string;              // extracted text snippet around query terms
    author: string | null;
    published_date: string | null;
    scores: ScoreBreakdown;
    final_score: number;          // composite normalized score
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
    articles_skipped: number;     // already indexed, content hash unchanged
    errors: IndexingError[];
    duration_ms: number;
  }
  
  export interface IndexingError {
    article_id: number;
    url: string;
    error: string;
  }
  
  export interface TokenizedDocument {
    doc_id: number;
    doc_length: number;           // total token count (content + title)
    tokens: TokenWithMetadata[];
  }
  
  export interface TokenWithMetadata {
    term: string;                 // normalized, stemmed token
    position: number;             // position in document token stream
    field: 'title' | 'content';  // which field it came from
  }