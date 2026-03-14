import { describe, expect, test } from "bun:test";
import { Normalize } from "../services/normalize";
import type { CrawledArticle } from "../utils/index";
import { testArticles } from "./fixtures";

describe("Normalize", () => {
  const normalizer = new Normalize();

  const algo = testArticles[0];
  const sysDesign = testArticles[2];
  const distSys = testArticles[4];
  const dbArticle = testArticles[6];
  const swEng = testArticles[8];

  describe("normalize", () => {
    test("should generate unique ID for each article", () => {
      const partial = { title: "Test", content: "Content", word_count: 10 };
      const a = normalizer.normalize(partial, algo.url);
      const b = normalizer.normalize(partial, sysDesign.url);
      expect(a.id).toBeDefined();
      expect(b.id).toBeDefined();
      expect(a.id).not.toBe(b.id);
    });

    test("should extract domain from real URLs", () => {
      const partial = { title: "Test", content: "Content", word_count: 10 };

      expect(normalizer.normalize(partial, algo.url).domain).toBe(
        "cp-algorithms.com",
      );
      expect(normalizer.normalize(partial, sysDesign.url).domain).toContain(
        "netflixtechblog.com",
      );
      expect(normalizer.normalize(partial, dbArticle.url).domain).toBe(
        "www.postgresql.org",
      );
    });

    test("should normalize URL by removing fragment", () => {
      const partial = { title: "Test", content: "Content", word_count: 10 };
      const result = normalizer.normalize(
        partial,
        algo.url + "#implementation",
      );
      expect(result.url_normalized).not.toContain("#");
      expect(result.url_normalized).toBe(algo.url);
    });

    test("should set crawl_timestamp to current time", () => {
      const before = new Date().toISOString();
      const partial = { title: "Test", content: "Content", word_count: 10 };
      const result = normalizer.normalize(partial, distSys.url);
      const after = new Date().toISOString();
      expect(result.crawl_timestamp >= before).toBe(true);
      expect(result.crawl_timestamp <= after).toBe(true);
    });

    test("should use defaults for missing optional fields", () => {
      const partial = { title: "Test", content: "Content", word_count: 10 };
      const result = normalizer.normalize(partial, swEng.url);
      expect(result.title).toBe("Test");
      expect(result.snippet).toBe("");
      expect(result.author).toBeNull();
      expect(result.published_date).toBeNull();
      expect(result.category).toBeNull();
      expect(result.difficulty).toBeNull();
      expect(result.quality_score).toBe(0);
      expect(result.is_indexed).toBe(0);
      expect(result.s3_snippet_key).toBeNull();
      expect(result.s3_content_key).toBeNull();
      expect(result.embedding_vector_json).toBeNull();
    });

    test("should use Untitled when title is missing", () => {
      const partial = { content: "Content", word_count: 10 };
      const result = normalizer.normalize(partial, algo.url);
      expect(result.title).toBe("Untitled");
    });

    test("should preserve provided fields", () => {
      const partial = {
        title: "Dijkstra's Shortest Path",
        snippet: "Graph algorithm for shortest paths",
        content: "Full article content about Dijkstra",
        word_count: 1500,
        author: "CP Algorithms",
        published_date: "2024-01-01",
        category: "algorithms-and-data-structures",
        quality_score: 80,
      };
      const result = normalizer.normalize(partial, algo.url);
      expect(result.title).toBe("Dijkstra's Shortest Path");
      expect(result.snippet).toBe("Graph algorithm for shortest paths");
      expect(result.content).toBe("Full article content about Dijkstra");
      expect(result.word_count).toBe(1500);
      expect(result.author).toBe("CP Algorithms");
      expect(result.published_date).toBe("2024-01-01");
      expect(result.category).toBe("algorithms-and-data-structures");
      expect(result.quality_score).toBe(80);
    });

    test("should set url to original URL", () => {
      const partial = { title: "Test", content: "C", word_count: 1 };
      const result = normalizer.normalize(partial, sysDesign.url);
      expect(result.url).toBe(sysDesign.url);
    });

    test("should handle 1000 normalizations in < 100ms", () => {
      const partial = { title: "Test", content: "C", word_count: 1 };
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        normalizer.normalize(
          partial,
          testArticles[i % testArticles.length].url,
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("normalizeUrl edge cases", () => {
    test("should throw on completely invalid URL", () => {
      const partial = { title: "Test", content: "C", word_count: 1 };
      expect(() => normalizer.normalize(partial, "not-a-valid-url")).toThrow();
    });
  });

  describe("output shape", () => {
    test("should return complete CrawledArticle with all required fields", () => {
      const partial = { title: "T", content: "C", word_count: 1 };
      const result = normalizer.normalize(partial, algo.url);
      const required: (keyof CrawledArticle)[] = [
        "id",
        "url",
        "url_normalized",
        "domain",
        "title",
        "snippet",
        "content",
        "word_count",
        "crawl_timestamp",
        "quality_score",
        "content_hash",
        "is_indexed",
      ];
      for (const key of required) {
        expect(result).toHaveProperty(key);
      }
    });
  });
});
