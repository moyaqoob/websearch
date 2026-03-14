import { afterEach, describe, expect, mock, test } from "bun:test";
import Calculate from "../services/Calculate";
import type { CrawledArticle } from "../utils";
describe("Calculate ranking engine", () => {
  const calculator = new Calculate();

  const TIER1_URL =
    "https://www.geeksforgeeks.org/dijkstras-shortest-path-algorithm-greedy-algo-7/";
  const TIER2_URL = "https://eng.uber.com/event-driven-architecture/";
  const TIER4_URL = "https://redis.io/blog/why-caching-matters/";
  const UNKNOWN_URL = "https://unknown-example.dev/posts/custom-search";

  function buildPassingArticle(
    overrides: Partial<CrawledArticle> = {},
  ): Partial<CrawledArticle> {
    const content = [
      "# Dijkstra algorithm explained",
      "This article explains how the algorithm works step by step.",
      "Time complexity is O(V + E log V) and space complexity is O(V).",
      "- build a priority queue",
      "- relax edges",
      "- track visited nodes",
      "<code>function dijkstra(graph) { return graph; }</code>",
      "<pre>const visited = new Set();</pre>",
      "Graph traversal, heap usage, and optimization strategy are covered in detail.",
      "word ".repeat(1400),
    ].join("\n");

    return {
      title: "Dijkstra Algorithm Implementation Guide",
      snippet: "Dijkstra summary",
      content,
      word_count: 1400,
      author: "Ada Lovelace",
      published_date: "2024-06-01",
      category: "algorithms-and-data-structures",
      ...overrides,
    };
  }

  describe("Stage 1 - tier detection", () => {
    test("matches premium algorithm domains using the precomputed map", () => {
      const result = calculator.checkUrl(TIER1_URL);
      expect(result.tier).toBe("TIER_1_PREMIUM");
      expect(result.config.authorityScore).toBe(95);
    });

    test("matches engineering domains via suffix handling", () => {
      const result = calculator.checkUrl(TIER2_URL);
      expect(result.tier).toBe("TIER_2_SYSTEM_DESIGN");
      expect(result.config.authorityScore).toBe(92);
    });

    test("falls back to the static unknown tier", () => {
      const result = calculator.checkUrl(UNKNOWN_URL);
      expect(result.tier).toBe("TIER_6_UNKNOWN");
      expect(result.config.authorityScore).toBe(40);
    });
  });

  describe("Stage 2 - gate filtering", () => {
    test("rejects articles below the tier word-count minimum", () => {
      const result = calculator.calculate(
        buildPassingArticle({ word_count: 99 }),
        TIER1_URL,
      );
      expect(result).toBeNull();
    });

    test("rejects articles without code examples when tier requires them", () => {
      const result = calculator.calculate(
        buildPassingArticle({
          content:
            "Algorithm explanation with time complexity and step by step reasoning. " +
            "word ".repeat(1400),
        }),
        TIER1_URL,
      );
      expect(result).toBeNull();
    });

    test("allows community/reference content without an author", () => {
      const result = calculator.calculate(
        buildPassingArticle({ author: undefined, word_count: 900 }),
        TIER4_URL,
      );
      expect(result).not.toBeNull();
    });
  });

  describe("Stage 3 - signal extraction", () => {
    test("normalizes content before hashing", () => {
      const a = calculator.calculate(
        buildPassingArticle({
          content:
            "Algorithm   Guide\n\n<code>const x = 1;</code>\nTime complexity is O(n).",
          word_count: 600,
        }),
        TIER4_URL,
      );
      const b = calculator.calculate(
        buildPassingArticle({
          content:
            "algorithm guide <code>const x = 1;</code> time complexity is O(n).",
          word_count: 600,
        }),
        TIER4_URL,
      );

      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a!.content_hash).toBe(b!.content_hash);
    });

    test("extracts all required ranking signals", () => {
      const result = calculator.calculate(buildPassingArticle(), TIER1_URL);
      expect(result).not.toBeNull();
      expect(result!.authority_score).toBeGreaterThan(0);
      expect(result!.quality_score).toBeGreaterThan(0);
      expect(result!.keyword_relevance_score).toBeGreaterThan(0);
      expect(result!.freshness_score).toBeGreaterThan(0);
      expect(result!.readability_score).toBeGreaterThanOrEqual(0);
    });

    test("uses logarithmic scaling for keyword relevance", () => {
      const low = calculator.calculate(
        buildPassingArticle({
          content:
            "algorithm graph tree <code>function solve() {}</code> time complexity is O(n). " +
            "word ".repeat(1300),
          word_count: 1300,
        }),
        TIER1_URL,
      );
      const high = calculator.calculate(
        buildPassingArticle({
          content:
            "algorithm ".repeat(120) +
            "graph ".repeat(120) +
            "tree ".repeat(120) +
            "dynamic programming ".repeat(120) +
            "<code>function x() {}</code>" +
            "word ".repeat(1300),
          word_count: 1800,
        }),
        TIER1_URL,
      );

      expect(low).not.toBeNull();
      expect(high).not.toBeNull();
      expect(high!.keyword_relevance_score).toBeGreaterThan(
        low!.keyword_relevance_score,
      );
      expect(high!.keyword_relevance_score).toBeLessThanOrEqual(100);
    });
  });

  describe("Stage 4 - weighted ranking", () => {
    

    test("includes tier and content hash in the ranked article", () => {
      const result = calculator.calculate(buildPassingArticle(), TIER1_URL);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe("TIER_1_PREMIUM");
      expect(result!.source_tier).toBe("TIER_1_PREMIUM");
      expect(result!.content_hash.length).toBe(64);
    });

    test("scores stronger sources higher than unknown ones for similar content", () => {
      const premium = calculator.calculate(buildPassingArticle(), TIER1_URL);
      const unknown = calculator.calculate(buildPassingArticle(), UNKNOWN_URL);

      expect(premium).not.toBeNull();
      expect(unknown).not.toBeNull();
      expect(premium!.ranking_score).toBeGreaterThan(unknown!.ranking_score);
    });
  });

  describe("pipeline performance", () => {
    test("ranks 1000 articles quickly enough for crawler use", () => {
      const article = buildPassingArticle();
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculator.calculate(article, TIER1_URL);
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(700);
    });
  });
});