import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import type { CrawledArticle } from "../utils/index";
import { Store } from "../services/store";
import { testArticles } from "./fixtures";

// ============================================================================
// HELPERS
// ============================================================================

function createArticlesTable(db: Database) {
  db.prepare(`
    CREATE TABLE articles (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      url_normalized TEXT,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      snippet TEXT,
      content TEXT,
      word_count INTEGER,
      author TEXT,
      published_date TEXT,
      updated_date TEXT,
      crawl_timestamp TEXT,
      category TEXT,
      difficulty TEXT,
      quality_score INTEGER,
      readability_score INTEGER,
      authority_score INTEGER,
      freshness_score INTEGER,
      popularity_score INTEGER,
      content_hash TEXT UNIQUE,
      is_indexed INTEGER DEFAULT 0,
      s3_snippet_key TEXT,
      s3_content_key TEXT,
      embedding_vector_json TEXT
    );
  `).run();
}

const algo = testArticles[0];
const sysDesign = testArticles[2];

function makeArticle(overrides: Partial<CrawledArticle> = {}): CrawledArticle {
  return {
    id: "test-id-123",
    url: algo.url,
    url_normalized: algo.url,
    domain: new URL(algo.url).hostname,
    title: "Dijkstra's Algorithm",
    snippet: "Shortest path algorithm using a priority queue",
    content: "Full article content about Dijkstra's shortest path algorithm in graphs",
    word_count: 1200,
    author: null,
    published_date: null,
    updated_date: null,
    crawl_timestamp: new Date().toISOString(),
    category: "algorithms-and-data-structures",
    difficulty: null,
    quality_score: 50,
    readability_score: 0,
    authority_score: 0,
    freshness_score: 0,
    popularity_score: 0,
    content_hash: "hash123",
    is_indexed: 0,
    s3_snippet_key: null,
    s3_content_key: null,
    embedding_vector_json: null,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("Storage", () => {
  let db: Database;
  let storage: Store;

  beforeEach(() => {
    db = new Database(":memory:");
    createArticlesTable(db);
    storage = new Store(db);
  });

  describe("store (database)", () => {
    test("should insert article into database", async () => {
      const article = makeArticle();
      const result = await storage.store(article);
      expect(result).toBe(true);

      const row = db
        .prepare("SELECT * FROM articles WHERE id = ?")
        .get(article.id) as any;
      expect(row).toBeDefined();
      expect(row.title).toBe(article.title);
      expect(row.url).toBe(algo.url);
      expect(row.domain).toBe(new URL(algo.url).hostname);
      expect(row.word_count).toBe(article.word_count);
    });

    test("should return false on duplicate id", async () => {
      const article = makeArticle();
      await storage.store(article);
      const second = await storage.store(article);
      expect(second).toBe(false);
    });

    test("should return false on duplicate content_hash", async () => {
      const article1 = makeArticle();
      await storage.store(article1);
      const article2 = makeArticle({
        id: "different-id",
        url: "https://cp-algorithms.com/other",
      });
      const result = await storage.store(article2);
      expect(result).toBe(false);
    });

    test("should store articles from different domains", async () => {
      const article1 = makeArticle({
        id: "a1",
        url: algo.url,
        domain: new URL(algo.url).hostname,
        content_hash: "h1",
      });
      const article2 = makeArticle({
        id: "a2",
        url: sysDesign.url,
        domain: new URL(sysDesign.url).hostname,
        title: "Zuul 2 at Netflix",
        content_hash: "h2",
      });

      expect(await storage.store(article1)).toBe(true);
      expect(await storage.store(article2)).toBe(true);

      const count = (
        db.prepare("SELECT COUNT(*) as c FROM articles").get() as any
      ).c;
      expect(count).toBe(2);
    });

    test("should handle nullable fields correctly", async () => {
      const article = makeArticle({
        author: null,
        published_date: null,
        updated_date: null,
        category: null,
        difficulty: null,
        s3_snippet_key: null,
        s3_content_key: null,
        embedding_vector_json: null,
      });
      const result = await storage.store(article);
      expect(result).toBe(true);

      const row = db
        .prepare("SELECT * FROM articles WHERE id = ?")
        .get(article.id) as any;
      expect(row.author).toBeNull();
      expect(row.published_date).toBeNull();
      expect(row.category).toBeNull();
    });

    test("should handle batch inserts within time budget (< 500ms for 100)", async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await storage.store(
          makeArticle({
            id: `batch-${i}`,
            url: `https://cp-algorithms.com/test/${i}`,
            content_hash: `hash-${i}`,
          }),
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);

      const count = (
        db.prepare("SELECT COUNT(*) as c FROM articles").get() as any
      ).c;
      expect(count).toBe(100);
    });
  });
});