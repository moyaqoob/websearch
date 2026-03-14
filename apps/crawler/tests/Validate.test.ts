import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { Validate } from "../services/Validate";
import type { CrawledArticle } from "../utils";

function createArticlesTable(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      content_hash TEXT UNIQUE,
      title TEXT
    );
  `);
}

describe("Validate", () => {
  let db: Database;
  let validator: Validate;

  beforeEach(() => {
    db = new Database(":memory:");
    createArticlesTable(db);
    validator = new Validate(db);
  });

  describe("title", () => {
    test("should reject when title is missing", () => {
      const article: Partial<CrawledArticle> = {};
      expect(validator.validate(article)).toBe(false);
    });

    test("should reject when title is too short (< 5 chars)", () => {
      const article: Partial<CrawledArticle> = { title: "Hi" };
      expect(validator.validate(article)).toBe(false);
    });

    test("should accept when title has 5+ chars", () => {
      const article: Partial<CrawledArticle> = {
        title: "CAP Theorem Explained",
      };
      expect(validator.validate(article)).toBe(true);
    });
  });

  describe("duplicate content (content_hash)", () => {
    test("should reject when content_hash already exists in DB", () => {
      const hash = "abc123hash";
      db.prepare(
        "INSERT INTO articles (id, url, content_hash) VALUES (?, ?, ?)",
      ).run("existing-id", "https://example.com/old", hash);

      const article: Partial<CrawledArticle> = {
        title: "Dijkstra's Algorithm",
        content_hash: hash,
      };
      expect(validator.validate(article)).toBe(false);
    });

    test("should accept when content_hash is unique", () => {
      const article: Partial<CrawledArticle> = {
        title: "System Design at Netflix",
        content_hash: "unique-hash-xyz",
      };
      expect(validator.validate(article)).toBe(true);
    });

    test("should skip duplicate check when content_hash is falsy", () => {
      const article: Partial<CrawledArticle> = {
        title: "Scaling Job Queues",
        content_hash: "",
      };
      expect(validator.validate(article)).toBe(true);
    });
  });

  describe("duplicate URL", () => {
    test("should reject when URL already exists in DB", () => {
      const url = "https://example.com/article";
      db.prepare(
        "INSERT INTO articles (id, url, content_hash) VALUES (?, ?, ?)",
      ).run("existing-id", url, "some-hash");

      const article: Partial<CrawledArticle> = {
        title: "Duplicate URL Article",
        url,
      };
      expect(validator.validate(article)).toBe(false);
    });

    test("should accept when URL is unique", () => {
      const article: Partial<CrawledArticle> = {
        title: "New Article",
        url: "https://example.com/new",
      };
      expect(validator.validate(article)).toBe(true);
    });
  });

  describe("combined validation", () => {
    test("valid article passes all checks", () => {
      const article: Partial<CrawledArticle> = {
        title: "Strong Consistency Models",
        content_hash: "new-hash",
        url: "https://example.com/unique",
      };
      expect(validator.validate(article)).toBe(true);
    });

    test("fails with short title even if hashes are unique", () => {
      const article: Partial<CrawledArticle> = {
        title: "Hi",
        content_hash: "unique-hash",
      };
      expect(validator.validate(article)).toBe(false);
    });
  });

  describe("throughput", () => {
    test("should validate 1000 articles in < 50ms", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        validator.validate({
          title: "Performance Test Article",
          content_hash: `hash-${i}`,
        });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
