import Database from "better-sqlite3";

// Path to the crawler database file (relative to process cwd by default)
const DB_PATH = process.env.CRAWLER_DB_PATH ?? "crawler.db";

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and durability
db.pragma("journal_mode = WAL");

/**
 * Initialize database schema for Article storage.
 *
 * This maps your TypeScript interfaces into a normalized schema:
 * - articles: core article metadata and scalar fields
 * - article_topics: many-to-many for article <-> topic
 * - article_languages: many-to-many for article <-> language
 * - code_blocks: code snippets per article
 * - sections: hierarchical sections per article
 * - external_links: outgoing links from article
 * - internal_links: internal links from article
 * - entities: extracted entities from article
 *
 * Some complex structures (embeddings, tf-idf vectors, entity positions)
 * are stored as JSON blobs for simplicity.
 */
export function initSchema() {
  const createStatements = [
    // Core article table
    `
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,                
      url TEXT NOT NULL,
      url_normalized TEXT NOT NULL,
      domain TEXT NOT NULL,

      title TEXT NOT NULL,
      snippet TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL,

      author TEXT,
      published_date TEXT,
      updated_date TEXT,
      crawl_timestamp TEXT NOT NULL,

      category TEXT,
      difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),

      quality_score REAL NOT NULL,
      readability_score REAL NOT NULL,
      authority_score REAL NOT NULL,
      freshness_score REAL NOT NULL,
      popularity_score REAL NOT NULL,

      content_hash TEXT NOT NULL,
      is_indexed INTEGER NOT NULL DEFAULT 0, -- 0/1 boolean

      s3_snippet_key TEXT,
      s3_content_key TEXT,

      -- Optional JSON blobs
      embedding_vector_json TEXT,
      tfidf_vectors_json TEXT
    );
    `,

    // Topics (string array) as simple many-to-many
    `
    CREATE TABLE IF NOT EXISTS article_topics (
      article_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      PRIMARY KEY (article_id, topic),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    `,

    // Languages (string array)
    `
    CREATE TABLE IF NOT EXISTS article_languages (
      article_id TEXT NOT NULL,
      language TEXT NOT NULL,
      PRIMARY KEY (article_id, language),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    `,

    // Code blocks
    `
    CREATE TABLE IF NOT EXISTS code_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      code TEXT NOT NULL,
      language TEXT,
      line_count INTEGER,
      is_runnable INTEGER NOT NULL DEFAULT 0, -- 0/1
      complexity TEXT,
      description TEXT,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    `,

    // Sections (allow nesting via parent_id)
    `
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      section_id TEXT NOT NULL,  -- Section.id from interface
      title TEXT NOT NULL,
      level INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_id INTEGER,         -- references sections(id) for hierarchy
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES sections(id) ON DELETE CASCADE
    );
    `,

    // External links
    `
    CREATE TABLE IF NOT EXISTS external_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      url TEXT NOT NULL,
      text TEXT,
      domain TEXT,
      target_authority REAL,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    `,

    // Internal links
    `
    CREATE TABLE IF NOT EXISTS internal_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      url TEXT NOT NULL,
      text TEXT,
      context TEXT,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    `,

    // Entities (store positions as JSON array)
    `
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,          -- 'algorithm' | 'data_structure' | ...
      confidence REAL NOT NULL,    -- 0-1
      positions_json TEXT NOT NULL, -- JSON-encoded positions:number[]
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );
    `,

    // Helpful indexes
    `
    CREATE INDEX IF NOT EXISTS idx_articles_domain ON articles(domain);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_articles_published_date ON articles(published_date);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_code_blocks_article_id ON code_blocks(article_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_sections_article_id ON sections(article_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_external_links_article_id ON external_links(article_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_internal_links_article_id ON internal_links(article_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_entities_article_id ON entities(article_id);
    `
  ];

  const transaction = db.transaction(() => {
    for (const sql of createStatements) {
      db.prepare(sql).run();
    }
  });

  transaction();
}

// Initialize schema immediately when this module is imported
initSchema();

// id: '9a82a316-cf02-4175-a350-2e63104d9b92',
// url: 'https://example.com',
// url_normalized: 'https://example.com',
// domain: 'example.com',
// title: 'Example Title',
// snippet: 'Example snippet',
// content: 'Example content',
// word_count: 10,
// author: null,
// published_date: null,
// updated_date: null,
// crawl_timest amp: '2026-03-05T06:29:26.217Z',
// category: null,
// difficulty: null,
// quality_score: 0,
// readability_score: 0,
// authority_score: 0,
// freshness_score: 0,
// popularity_score: 0,
// content_hash: 'hash123',
// is_indexed: 0,
// s3_snippet_key: null,
// s3_content_key: null,
// embedding_vector_json: null,
// tfidf_vectors_json: null
// },