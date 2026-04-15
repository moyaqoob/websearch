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
