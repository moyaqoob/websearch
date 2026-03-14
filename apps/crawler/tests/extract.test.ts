import { describe, expect, test } from "bun:test";
import { Extract } from "../services/extract";
import { testArticles } from "./fixtures";

describe("Extract", () => {
  const extractor = new Extract();

  const algo = testArticles[0];
  const sysDesign = testArticles[2];
  const distSys = testArticles[4];
  const dbArticle = testArticles[6];
  const swEng = testArticles[8];

  describe("extractTitle", () => {
    test("should extract h1 as primary title", () => {
      const html = `
        <html><head><title>Fallback Title</title></head>
        <body><h1>Dijkstra's Shortest Path Algorithm</h1><p>Content here</p></body></html>
      `;
      const { article } = extractor.extract(html, algo.url);
      expect(article.title).toBe("Dijkstra's Shortest Path Algorithm");
    });

    test("should fall back to title tag when no h1", () => {
      const html = `
        <html><head><title>Netflix Tech Blog - Zuul 2</title></head>
        <body><p>Content</p></body></html>
      `;
      const { article } = extractor.extract(html, sysDesign.url);
      expect(article.title).toBe("Netflix Tech Blog - Zuul 2");
    });

    test("should use og:title when no h1 and no title tag", () => {
      const html = `
        <html><head>
          <meta property="og:title" content="Please stop calling databases CP or AP" />
        </head><body><p>Content</p></body></html>
      `;
      const { article } = extractor.extract(html, distSys.url);
      expect(article.title).toBe("Please stop calling databases CP or AP");
    });

    test("should return Untitled when no title source exists", () => {
      const html = `<html><body><p>Just content</p></body></html>`;
      const { article } = extractor.extract(html, dbArticle.url);
      expect(article.title).toBe("Untitled");
    });
  });

  describe("extractContent", () => {
    test("should extract content from article/main elements", () => {
      const html = `
        <html><body>
          <article><p>Dijkstra's algorithm finds the shortest path from a source vertex to all other vertices in a weighted graph using a priority queue and greedy approach.</p></article>
        </body></html>
      `;
      const { article } = extractor.extract(html, algo.url);
      expect(article.content).toContain("Dijkstra");
      expect(article.word_count).toBeGreaterThan(0);
    });

    test("should fall back to body when no article element", () => {
      const html = `
        <html><body><p>MVCC provides concurrent access to the database without locking</p></body></html>
      `;
      const { article } = extractor.extract(html, dbArticle.url);
      expect(article.content).toContain("MVCC");
    });

    test("should remove script and style tags", () => {
      const html = `
        <html><body>
          <script>alert('xss')</script>
          <style>.hidden{display:none}</style>
          <p>Microservices architecture decouples applications into small services</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, swEng.url);
      expect(article.content).not.toContain("alert");
      expect(article.content).not.toContain(".hidden");
      expect(article.content).toContain("Microservices");
    });

    test("should limit content to 100K chars", () => {
      const longContent = "word ".repeat(25000);
      const html = `<html><body><p>${longContent}</p></body></html>`;
      const { article } = extractor.extract(html, algo.url);
      expect(article.content!.length).toBeLessThanOrEqual(100000);
    });

    test("should produce snippet as first 200 chars of content", () => {
      const content = "A".repeat(500);
      const html = `<html><body><p>${content}</p></body></html>`;
      const { article } = extractor.extract(html, sysDesign.url);
      expect(article.snippet?.length).toBe(200);
      expect(article.snippet).toBe(article.content?.substring(0, 200));
    });
  });

  describe("extractAuthor", () => {
    test("should extract author from rel=author", () => {
      const html = `
        <html><body>
          <a rel="author" href="#">Martin Kleppmann</a>
          <p>Content about distributed systems</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, distSys.url);
      expect(article.author).toBe("Martin Kleppmann");
    });

    test("should return null when no author present", () => {
      const html = `<html><body><p>Content</p></body></html>`;
      const { article } = extractor.extract(html, algo.url);
      expect(article.author).toBeNull();
    });
  });

  describe("extractDate", () => {
    test("should extract ISO date from time datetime attribute", () => {
      const html = `
        <html><body>
          <time datetime="2024-01-15T10:00:00Z">Jan 15</time>
          <p>Content about system design at scale</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, sysDesign.url);
      expect(article.published_date).toBe("2024-01-15");
    });

    test("should extract from article:published_time meta", () => {
      const html = `
        <html><head>
          <meta property="article:published_time" content="2023-06-20T12:00:00Z" />
        </head><body><p>Content</p></body></html>
      `;
      const { article } = extractor.extract(html, swEng.url);
      expect(article.published_date).toBe("2023-06-20");
    });

    test("should return null for invalid date", () => {
      const html = `
        <html><body>
          <time datetime="invalid">Bad</time>
          <p>Content</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, algo.url);
      expect(article.published_date).toBeNull();
    });
  });

  describe("detectCategory", () => {
    test("should detect algorithms-and-data-structures", () => {
      const html = `
        <html><body>
          <h1>Dijkstra's Algorithm</h1>
          <p>Shortest path algorithm using a priority queue. Time complexity is O(V + E log V) with a binary heap. Dynamic programming and graph traversal are key concepts.</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, algo.url);
      expect(article.category).toBe("algorithms-and-data-structures");
    });

    test("should detect system-design", () => {
      const html = `
        <html><body>
          <h1>Scaling Slack's Job Queue</h1>
          <p>Scalability, load balancer, microservices, database sharding, caching layer, message queue, kafka, high availability.</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, sysDesign.url);
      expect(article.category).toBe("system-design");
    });

    test("should detect distributed-systems", () => {
      const html = `
        <html><body>
          <h1>Strong Consistency Models</h1>
          <p>Linearizability and serializability in distributed systems. Consensus protocols like raft and paxos. Leader election and quorum reads.</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, distSys.url);
      expect(article.category).toBe("distributed-systems");
    });

    test("should detect databases", () => {
      const html = `
        <html><body>
          <h1>MVCC in PostgreSQL</h1>
          <p>Multi-version concurrency control in PostgreSQL. Transaction isolation levels, ACID properties, vacuum, indexing, and query optimization.</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, dbArticle.url);
      expect(article.category).toBe("databases");
    });

    test("should detect software-engineering", () => {
      const html = `
        <html><body>
          <h1>Microservices</h1>
          <p>Software architecture patterns, clean code, refactoring, design patterns, testing, continuous integration, deployment, docker, kubernetes.</p>
        </body></html>
      `;
      const { article } = extractor.extract(html, swEng.url);
      expect(article.category).toBe("software-engineering");
    });

    test("should return null for uncategorized content", () => {
      const html = `<html><body><h1>Random Topic</h1><p>Generic text about cooking recipes</p></body></html>`;
      const { article } = extractor.extract(html, algo.url);
      expect(article.category).toBeNull();
    });
  });

  describe("extractInternalLinks", () => {
    test("should extract internal links and exclude external ones", () => {
      const html = `
        <html><body>
          <a href="/graph/bfs.html">BFS</a>
          <a href="https://cp-algorithms.com/graph/dfs.html">DFS</a>
          <a href="https://other.com/external">External</a>
          <p>Content</p>
        </body></html>
      `;
      const { article, discoveredUrls } = extractor.extract(html, algo.url);
      expect(article).toBeDefined();
      expect(article.title).toBeDefined();
      expect(discoveredUrls.length).toBeGreaterThan(0);
      expect(discoveredUrls.every((u) => u.includes("cp-algorithms.com"))).toBe(
        true,
      );
    });
  });

  describe("word count", () => {
    test("should count words correctly", () => {
      const html = `
        <html><body><p>dijkstra shortest path algorithm graph</p></body></html>
      `;
      const { article } = extractor.extract(html, algo.url);
      expect(article.word_count).toBe(5);
    });
  });

  describe("edge cases", () => {
    test("should handle empty HTML", () => {
      const { article } = extractor.extract("", algo.url);
      expect(article.title).toBe("Untitled");
      expect(article.content).toBe("");
      expect(article.word_count).toBe(0);
    });

    test("should handle malformed HTML gracefully", () => {
      const html = "<div>Unclosed<div>Nested content about algorithms";
      const result = extractor.extract(html, sysDesign.url);
      expect(result).toBeDefined();
    });

    test("should process large HTML within time budget (< 200ms)", () => {
      const body = "<p>" + "word ".repeat(20000) + "</p>";
      const html = `<html><body>${body}</body></html>`;
      const start = performance.now();
      const { article } = extractor.extract(html, algo.url);
      const elapsed = performance.now() - start;
      expect(article.word_count).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
