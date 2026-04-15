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

CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    url_normalized TEXT NOT NULL,
    domain TEXT,
    title TEXT NOT NULL,
    content TEXT,
    content_hash TEXT UNIQUE,
    is_indexed INTEGER DEFAULT 0,
    crawl_timestamp TEXT,
    published_date TEXT,
    UNIQUE(url_normalized)
);

CREATE TABLE IF NOT EXISTS signals (
    article_id TEXT PRIMARY KEY,
    quality_score REAL DEFAULT 0,
    readability_score REAL DEFAULT 0,
    authority_score REAL DEFAULT 0,
    freshness_score REAL DEFAULT 0,
    popularity_score REAL DEFAULT 0,
    computed_at TEXT,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO index_metadata (id, last_updated)
VALUES (1, datetime('now'));
