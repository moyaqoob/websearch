import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { Calculate } from "../services/Calculate";
import { Validate } from "../services/Validate";
import { Extract } from "../services/extract";
import { Fetcher } from "../services/fetcher";
import { Normalize } from "../services/normalize";
import { RobotsTxt } from "../services/robotsTxt";
import type { CrawledArticle } from "../utils";
import { testArticles } from "./fixtures";

function createArticlesTable(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
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
      source_tier TEXT,
      is_indexed INTEGER DEFAULT 0,
      s3_snippet_key TEXT,
      s3_content_key TEXT,
      embedding_vector_json TEXT
    );
  `);
}

describe("Integration: full pipeline", () => {
  const robots = new RobotsTxt();
  const f = new Fetcher();
  const extractor = new Extract();
  const calculator = new Calculate();
  const normalizer = new Normalize();
  let db: Database;
  let validator: Validate;

  beforeAll(() => {
    db = new Database(":memory:");
    createArticlesTable(db);
    validator = new Validate(db);
  });

  test(
    "robots.txt is fetched and parsed for all fixture domains",
    async () => {
      const domains = [
        ...new Set(testArticles.map((a) => new URL(a.url).origin)),
      ];
      for (const domain of domains) {
        const parsed = await robots.fetchRobots(domain);
        expect(parsed).toBeDefined();
        expect(parsed.rules).toBeDefined();
      }
    },
    { timeout: 30000 },
  );

  test(
    "fetch → extract → calculate → normalize pipeline on a real article",
    async () => {
      const article = testArticles[0];
      const { allowed, delay } = await robots.canCrawl(article.url);
      if (!allowed) {
        console.log(`Skipping ${article.url} — robots.txt disallow`);
        return;
      }
      await Bun.sleep(delay * 1000);

      const html = await f.fetcher(article.url);
      if (!html) {
        console.log(`Skipping ${article.url} — empty response`);
        return;
      }
      expect(html.length).toBeGreaterThan(500);

      const { article: extracted } = extractor.extract(html, article.url);
      expect(extracted.title).toBeDefined();
      expect(extracted.title).not.toBe("Untitled");
      expect(extracted.word_count).toBeGreaterThan(50);

      const calculated = calculator.calculate(extracted, article.url);
      if (!calculated) {
        console.log(`Article rejected by tier gates: ${article.url}`);
        return;
      }
      expect(calculated.content_hash).toBeDefined();
      expect(calculated.quality_score).toBeGreaterThanOrEqual(0);
      expect(calculated.source_tier).toBeDefined();

      const normalized = normalizer.normalize(calculated, article.url);
      expect(normalized.id).toBeDefined();
      expect(normalized.domain).toBe("cp-algorithms.com");
      expect(normalized.url).toBe(article.url);
      expect(normalized.crawl_timestamp).toBeDefined();
    },
    { timeout: 15000 },
  );

  test(
    "batch pipeline: 3 articles with rate limiting",
    async () => {
      const batch = testArticles.slice(0, 3);
      const processed: CrawledArticle[] = [];
      const timings: number[] = [];

      for (const article of batch) {
        const { allowed, delay } = await robots.canCrawl(article.url);
        if (!allowed) {
          console.log(`Skipping ${article.url} — robots.txt disallow`);
          continue;
        }
        await Bun.sleep(delay * 1000);

        const start = performance.now();
        try {
          const html = await f.fetcher(article.url);
          if (!html) {
            console.log(`Empty response: ${article.url}`);
            continue;
          }
          const { article: extracted } = extractor.extract(html, article.url);
          const calculated = calculator.calculate(extracted, article.url);
          if (!calculated) {
            console.log(`Rejected by tier gates: ${article.url}`);
            continue;
          }
          const normalized = normalizer.normalize(calculated, article.url);
          processed.push(normalized);
          timings.push(performance.now() - start);
        } catch (err) {
          console.log(`Failed to process ${article.url}: ${err}`);
        }
      }

      expect(processed.length).toBeGreaterThanOrEqual(1);

      for (const article of processed) {
        expect(article.id).toBeDefined();
        expect(article.title).toBeDefined();
        expect(article.domain).toBeDefined();
        expect(article.content.length).toBeGreaterThan(0);
        expect(article.content_hash).toBeDefined();
      }

      const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      console.log(
        `Pipeline avg: ${avgMs.toFixed(0)}ms/article. ` +
          `Projected for 500 articles: ${((avgMs * 500) / 60000).toFixed(1)} min ` +
          `(+ rate-limit delays)`,
      );
      expect(avgMs).toBeLessThan(10000);
    },
    { timeout: 60000 },
  );

  test("extract + calculate + normalize throughput (no network, 1000 iterations)", () => {
    const html = `
      <html><head><title>Test Article</title></head>
      <body>
        <article>
          <h1>Dijkstra's Algorithm</h1>
          <p>${"Graph algorithm shortest path priority queue heap binary search tree adjacency list weighted edges relaxation greedy approach dynamic programming. ".repeat(50)}</p>
          <time datetime="2024-06-15T10:00:00Z">Jun 15, 2024</time>
          <a rel="author">Test Author</a>
        </article>
      </body>
    </html>`;

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const url = testArticles[i % testArticles.length].url;
      const { article: extracted } = extractor.extract(html, url);
      const calculated = calculator.calculate(extracted, url);
      if (calculated) {
        normalizer.normalize(calculated, url);
      }
    }
    const elapsed = performance.now() - start;

    console.log(
      `Extract+Calculate+Normalize: 1000 iterations in ${elapsed.toFixed(0)}ms (${(elapsed / 1000).toFixed(2)}ms/article)`,
    );
    expect(elapsed).toBeLessThan(10000);
  });

  test("validate throughput with DB lookups (1000 articles)", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      validator.validate({
        word_count: 600,
        title: "Performance Test Article Title",
        quality_score: 50,
        content_hash: `perf-hash-${i}`,
      });
    }
    const elapsed = performance.now() - start;

    console.log(
      `Validate: 1000 iterations in ${elapsed.toFixed(0)}ms (${(elapsed / 1000).toFixed(2)}ms/article)`,
    );
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("Integration: robots.txt compliance", () => {
  const robots = new RobotsTxt();

  test("should parse robots.txt correctly", () => {
    const txt = `
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /admin/public
Crawl-delay: 2
Sitemap: https://example.com/sitemap.xml
    `;
    const parsed = robots.parse(txt);
    expect(parsed.rules.length).toBe(3);
    expect(parsed.crawlDelay).toBe(2);
    expect(parsed.sitemaps).toContain("https://example.com/sitemap.xml");

    expect(robots.isAllowed("/admin/secret", parsed)).toBe(false);
    expect(robots.isAllowed("/admin/public", parsed)).toBe(true);
    expect(robots.isAllowed("/blog/post", parsed)).toBe(true);
  });

  test(
    "should fetch and respect real robots.txt for fixture domains",
    async () => {
      for (const article of testArticles.slice(0, 4)) {
        const { allowed, delay } = await robots.canCrawl(article.url);
        expect(typeof allowed).toBe("boolean");
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    },
    { timeout: 20000 },
  );
});
