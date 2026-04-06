import type Calculate from "./Calculate";
import type { Initialize } from "./Initialize";
import type { Validate } from "./Validate";
import type { Extract } from "./extract";
import type { Fetcher } from "./fetcher";
import type { Normalize } from "./normalize";
import type { RobotsTxt } from "./robotsTxt";
import type Store from "./store";

export const CRAWL_CONFIG = {
    concurrency: 8,
    requestDelayMs: 300,
    fetchTimeoutMs: 12_000,
    maxRetries: 1,
    batchSize: 5000,
  };
  
 export  type CrawlResult = "stored" | "skipped" | "failed";
  
 export  type CrawlStats = {
    stored: number;
    skipped: number;
    failed: number;
  };
  
 export  class DomainRateLimiter {
    private lastFetch = new Map<string, number>();
  
    constructor(private readonly delayMs = 300) {}
  
    async wait(domain: string, minDelayMs = this.delayMs): Promise<void> {
      const last = this.lastFetch.get(domain) ?? 0;
      const elapsed = Date.now() - last;
      const effectiveDelay = Math.max(this.delayMs, minDelayMs);
      const remaining = effectiveDelay - elapsed;
  
      if (remaining > 0) {
        await Bun.sleep(remaining);
      }
  
      this.lastFetch.set(domain, Date.now());
    }
  }
  
export  async function crawlWithConcurrency(
    urls: string[],
    crawlOne: (url: string) => Promise<void>,
    concurrency: number,
  ): Promise<void> {
    const queue = [...urls];
    const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
      while (queue.length > 0) {
        const nextUrl = queue.shift();
        if (nextUrl) {
          try {
            await crawlOne(nextUrl);
          } catch (err) {
            console.log(`  Worker error on ${nextUrl}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    });
  
    await Promise.allSettled(workers);
  }
  
 export  async function fetchWithRetry(
    url: string,
    fetchService: Fetcher,
    rateLimiter: DomainRateLimiter,
    minDelayMs: number,
  ): Promise<string | null> {
    const domain = new URL(url).hostname;
  
    for (let attempt = 0; attempt <= CRAWL_CONFIG.maxRetries; attempt++) {
      await rateLimiter.wait(domain, minDelayMs);
      const html = await fetchService.fetcher(url);
      if (html) {
        return html;
      }
    }
  
    return null;
  }
  
  export async function crawlUrl(
    url: string,
    init: Initialize,
    robots: RobotsTxt,
    fetchService: Fetcher,
    extractor: Extract,
    calculator: Calculate,
    validator: Validate,
    normalizer: Normalize,
    store: Store,
    rateLimiter: DomainRateLimiter,
  ): Promise<CrawlResult> {
    try {
      const { tier, config } = calculator.DetectTier(url);
      console.log(`  Tier: ${config.name} (${tier})`);
  
      const { allowed, delay } = await robots.canCrawl(url);
      if (!allowed) {
        console.log("  Skipped: disallowed by robots.txt");
        return "skipped";
      }
  
      const html = await fetchWithRetry(
        url,
        fetchService,
        rateLimiter,
        Math.max(CRAWL_CONFIG.requestDelayMs, delay * 1000),
      );
  
      if (!html) {
        console.log("  Skipped: empty response after retry");
        return "skipped";
      }
  
      const { article: extracted, discoveredUrls } = extractor.extract(html, url);
      const queueUpdate = init.addDiscoveredUrls(
        discoveredUrls,
        new URL(url).hostname,
      );
      init.updateSeedStats(url, discoveredUrls.length);
  
      if (
        queueUpdate.inserted > 0 ||
        queueUpdate.duplicates > 0 ||
        queueUpdate.discarded > 0
      ) {
        console.log(
          `  Queue: +${queueUpdate.inserted} new, ${queueUpdate.duplicates} existing, ${queueUpdate.discarded} discarded`,
        );
      }
  
      const calculated = calculator.calculate(extracted, url);
      if (!calculated) {
        console.log("  Skipped: rejected by tier gates");
        return "skipped";
      }
  
      if (!validator.validate(calculated.article)) {
        console.log("  Skipped: validation failed");
        return "skipped";
      }
  
      const normalized = normalizer.normalize(calculated.article, url);
      const success = await store.store(normalized,calculated.signals);
  
      if (!success) {
        console.log("  Failed: could not store");
        return "failed";
      }
  
      console.log(`  Stored: ${normalized.title} [${normalized}]`);
      return "stored";
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      return "failed";
    }
  }
  
export function recordResult(stats: CrawlStats, result: CrawlResult): void {
    if (result === "stored") stats.stored++;
    else if (result === "skipped") stats.skipped++;
    else stats.failed++;
  }