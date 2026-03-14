import Calculate from "./services/Calculate";
import { Extract } from "./services/extract";
import { Fetcher } from "./services/fetcher";
import { Initialize } from "./services/Initialize";
import { Normalize } from "./services/normalize";
import { RobotsTxt } from "./services/robotsTxt";
import { Store } from "./services/store";
import { Validate } from "./services/Validate";

const CRAWL_CONFIG = {
  concurrency: 8,
  requestDelayMs: 300,
  fetchTimeoutMs: 12_000,
  maxRetries: 1,
  batchSize: 50,
};

type CrawlResult = "stored" | "skipped" | "failed";

type CrawlStats = {
  stored: number;
  skipped: number;
  failed: number;
};

class DomainRateLimiter {
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

async function crawlWithConcurrency(
  urls: string[],
  crawlOne: (url: string) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (queue.length > 0) {
      const nextUrl = queue.shift();
      if (nextUrl) {
        await crawlOne(nextUrl);
      }
    }
  });

  await Promise.all(workers);
}

async function fetchWithRetry(
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

async function crawlUrl(
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
    const { tier, config } = calculator.checkUrl(url);
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

    if (!validator.validate(calculated)) {
      console.log("  Skipped: validation failed");
      return "skipped";
    }

    const normalized = normalizer.normalize(calculated, url);
    const success = await store.store(normalized);

    if (!success) {
      console.log("  Failed: could not store");
      return "failed";
    }

    console.log(`  Stored: ${normalized.title} [${normalized.source_tier}]`);
    return "stored";
  } catch (err) {
    console.error(`  Error: ${err instanceof Error ? err.message : err}`);
    return "failed";
  }
}

function recordResult(stats: CrawlStats, result: CrawlResult): void {
  if (result === "stored") stats.stored++;
  else if (result === "skipped") stats.skipped++;
  else stats.failed++;
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("CRAWLER - INITIALIZING");
  console.log("=".repeat(70));

  const init = new Initialize();
  const db = init.getDatabase();
  const config = init.getConfig();
  const robots = new RobotsTxt();
  const fetchService = new Fetcher(CRAWL_CONFIG.fetchTimeoutMs);
  const extractor = new Extract();
  const calculator = new Calculate();
  const validator = new Validate(db);
  const normalizer = new Normalize();
  const store = new Store(db);
  const rateLimiter = new DomainRateLimiter(CRAWL_CONFIG.requestDelayMs);
  const stats: CrawlStats = { stored: 0, skipped: 0, failed: 0 };

  console.log("\n" + "=".repeat(70));
  console.log("PHASE 1: CRAWLING SEED URLS");
  console.log("=".repeat(70));

  while (true) {
    const seedBatch = init.getNextSeedUrls(CRAWL_CONFIG.batchSize);
    if (seedBatch.length === 0) break;

    await crawlWithConcurrency(
      seedBatch,
      async (seedUrl) => {
        console.log(`\n[Seed] ${seedUrl}`);
        const result = await crawlUrl(
          seedUrl,
          init,
          robots,
          fetchService,
          extractor,
          calculator,
          validator,
          normalizer,
          store,
          rateLimiter,
        );

        init.markSeedAsCrawled(seedUrl, result === "stored" ? 1 : 0);
        recordResult(stats, result);
      },
      CRAWL_CONFIG.concurrency,
    );
  }

  const seedStats = init.getSeedCount();
  console.log(
    `\nPhase 1 done - Seeds crawled: ${seedStats.crawled}/${seedStats.total}`,
  );

  console.log("\n" + "=".repeat(70));
  console.log("PHASE 2: CRAWLING DISCOVERED URLS");
  console.log("=".repeat(70));

  let discoveredProcessed = 0;

  while (discoveredProcessed < config.maxPagesPerDomain) {
    const remaining = config.maxPagesPerDomain - discoveredProcessed;
    const discoveredBatch = init.getNextDiscoveredUrls(
      Math.min(CRAWL_CONFIG.batchSize, remaining),
    );

    if (discoveredBatch.length === 0) break;

    await crawlWithConcurrency(
      discoveredBatch,
      async (discoveredUrl) => {
        console.log(`\n[Discovered] ${discoveredUrl}`);
        const result = await crawlUrl(
          discoveredUrl,
          init,
          robots,
          fetchService,
          extractor,
          calculator,
          validator,
          normalizer,
          store,
          rateLimiter,
        );

        recordResult(stats, result);
      },
      CRAWL_CONFIG.concurrency,
    );

    discoveredProcessed += discoveredBatch.length;
  }

  const status = init.getCrawlStatus();
  init.close();

  console.log(`\n${"=".repeat(70)}`);
  console.log("CRAWL COMPLETE");
  console.log(
    `  Stored: ${stats.stored} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`,
  );
  console.log(`  Seeds: ${status.seeds.crawled}/${status.seeds.total}`);
  console.log(
    `  Discovered: ${status.discovered.crawled}/${status.discovered.total}`,
  );
  console.log(`  Total articles: ${status.articles}`);
  console.log("=".repeat(70));
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

main().catch(console.error);
