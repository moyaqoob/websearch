import { afterEach, describe, expect, mock, test } from "bun:test";
import { Fetcher, generateCrawlerHeaders } from "../services/fetcher";
import { RobotsTxt } from "../services/robotsTxt";
import { testArticles } from "./fixtures";

const algo = testArticles[0];
const sysDesign = testArticles[2];
const dbArticle = testArticles[6];

describe("generateCrawlerHeaders", () => {
  test("should return headers with User-Agent", () => {
    const headers = generateCrawlerHeaders();
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["User-Agent"].length).toBeGreaterThan(0);
  });

  test("should include Accept header for HTML", () => {
    const headers = generateCrawlerHeaders();
    expect(headers["Accept"]).toContain("text/html");
  });

  test("should include Accept-Language", () => {
    const headers = generateCrawlerHeaders();
    expect(headers["Accept-Language"]).toBeDefined();
  });

  test("should randomize User-Agent across calls", () => {
    const agents = new Set<string>();
    for (let i = 0; i < 20; i++) {
      agents.add(generateCrawlerHeaders()["User-Agent"]);
    }
    expect(agents.size).toBeGreaterThan(1);
  });
});

describe("fetcher (unit — mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("should return HTML when fetch succeeds", async () => {
    const mockHtml = "<html><body>Dijkstra's Algorithm</body></html>";
    globalThis.fetch = Object.assign(
      mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockHtml),
        } as Response),
      ),
      { preconnect: originalFetch.preconnect },
    );

    const f = new Fetcher();
    const result = await f.fetcher(algo.url);
    expect(result).toBe(mockHtml);
  });

  test("should throw when response is not ok", async () => {
    globalThis.fetch = Object.assign(
      mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response),
      ),
      { preconnect: originalFetch.preconnect },
    );

    const f = new Fetcher();
    await expect(f.fetcher(algo.url)).rejects.toThrow("Cannot fetch the page");
  });

  test("should throw when network fails entirely", async () => {
    globalThis.fetch = Object.assign(
      mock(() => Promise.reject(new Error("Network error"))),
      { preconnect: originalFetch.preconnect },
    );

    const f = new Fetcher();
    await expect(f.fetcher("https://invalid.test")).rejects.toThrow(
      "Cannot fetch the page",
    );
  });

  test("should pass crawler headers to fetch", async () => {
    let capturedHeaders: HeadersInit | undefined;
    globalThis.fetch = Object.assign(
      mock((input: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("<html></html>"),
        } as Response);
      }),
      { preconnect: originalFetch.preconnect },
    );

    const f = new Fetcher();
    await f.fetcher(sysDesign.url);
    expect(capturedHeaders).toBeDefined();
    const h = capturedHeaders as Record<string, string>;
    expect(h["User-Agent"]).toBeDefined();
    expect(h["Accept"]).toContain("text/html");
  });
});

describe("fetcher (integration — real network)", () => {
  const robots = new RobotsTxt();

  test(
    "should fetch real algorithm article",
    async () => {
      const { allowed, delay } = await robots.canCrawl(algo.url);
      if (!allowed) return;
      await Bun.sleep(delay * 1000);

      const f = new Fetcher();
      const html = await f.fetcher(algo.url);
      expect(html?.length).toBeGreaterThan(100);
      expect(html).toContain("<");
    },
    { timeout: 15000 },
  );

  test(
    "should fetch real database article",
    async () => {
      const { allowed, delay } = await robots.canCrawl(dbArticle.url);
      if (!allowed) return;
      await Bun.sleep(delay * 1000);

      const f = new Fetcher();
      const html = await f.fetcher(dbArticle.url);
      expect(html?.length).toBeGreaterThan(100);
    },
    { timeout: 15000 },
  );

  test(
    "should respect rate limiting across sequential fetches",
    async () => {
      const urls = [algo.url, dbArticle.url];
      const f = new Fetcher();
      const results: string[] = [];

      for (const url of urls) {
        const { allowed, delay } = await robots.canCrawl(url);
        if (!allowed) continue;
        await Bun.sleep(delay * 1000);
        const html = await f.fetcher(url);
        results.push(html!);
      }

      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const html of results) {
        expect(html.length).toBeGreaterThan(100);
      }
    },
    { timeout: 30000 },
  );
});
