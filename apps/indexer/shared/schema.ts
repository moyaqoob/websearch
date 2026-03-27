// ============================================================
// Index Schema
//
// The inverted index lives in SQLite alongside your Articles
// table. We use a separate logical "schema" (same database,
// separate table prefix) so it can be dropped and rebuilt
// independently of your crawl data.
//
// Table design decisions:
//
// 1. `index_terms` — the vocabulary/dictionary.
//    Normalized term → term_id mapping. Storing term_id as
//    INTEGER instead of term TEXT in postings saves ~60% space
//    on the postings table for long vocabularies.
//
// 2. `index_postings` — the core inverted index.
//    One row per (term, document) pair. Storing positions as
//    JSON blob is a tradeoff: it's not as fast as a separate
//    positions table, but avoids a JOIN for the common case
//    where you don't need positions. When you add phrase query
//    support, you can move to a separate table.
//
// 3. `index_doc_lengths` — per-document token counts.
//    BM25 requires knowing each document's length and the
//    corpus average. We store individual lengths here and
//    compute the average at query time (or cache it in metadata).
//
// 4. `index_metadata` — corpus-level statistics.
//    Single-row table. Updated atomically after each indexing run.
//
// Why not SQLite FTS5?
//    FTS5 is fast and correct, but its ranking function (BM25)
//    is not extensible. You cannot inject quality_score or
//    authority_score into the FTS5 ranking without hacks.
//    Rolling our own gives us full control over the final
//    scoring formula — which is the entire point of this engine.
// ============================================================

export const INDEX_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS index_terms (
    term_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    term      TEXT    NOT NULL UNIQUE,
    doc_freq  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_terms_term ON index_terms(term);

  CREATE TABLE IF NOT EXISTS index_postings (
    term_id        INTEGER NOT NULL REFERENCES index_terms(term_id) ON DELETE CASCADE,
    doc_id         TEXT    NOT NULL,
    term_frequency INTEGER NOT NULL,
    title_tf       INTEGER NOT NULL DEFAULT 0,
    content_tf     INTEGER NOT NULL DEFAULT 0,
    positions_json TEXT    NOT NULL,
    PRIMARY KEY (term_id, doc_id)
  );
  CREATE INDEX IF NOT EXISTS idx_postings_term ON index_postings(term_id);
  CREATE INDEX IF NOT EXISTS idx_postings_doc  ON index_postings(doc_id);

  CREATE TABLE IF NOT EXISTS index_doc_lengths (
    doc_id     TEXT    PRIMARY KEY,
    doc_length INTEGER NOT NULL,
    indexed_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS index_metadata (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    total_documents     INTEGER NOT NULL DEFAULT 0,
    avg_document_length REAL    NOT NULL DEFAULT 0.0,
    total_terms         INTEGER NOT NULL DEFAULT 0,
    last_updated        TEXT    NOT NULL,
    index_version       INTEGER NOT NULL DEFAULT 1
  );

  INSERT OR IGNORE INTO index_metadata (id, last_updated)
  VALUES (1, datetime('now'));
`;

export const DROP_INDEX_SCHEMA_SQL = `
  DROP TABLE IF EXISTS index_postings;
  DROP TABLE IF EXISTS index_terms;
  DROP TABLE IF EXISTS index_doc_lengths;
  DROP TABLE IF EXISTS index_metadata;
`;