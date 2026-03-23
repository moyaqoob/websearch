import Calculate from "./services/Calculate";
import { Extract } from "./services/extract";
import { Fetcher } from "./services/fetcher";
import { Initialize } from "./services/Initialize";
import { Normalize } from "./services/normalize";
import { RobotsTxt } from "./services/robotsTxt";
import { Store } from "./services/store";
import { Validate } from "./services/Validate";




import { type CrawlStats, type CrawlResult, CRAWL_CONFIG, DomainRateLimiter, crawlWithConcurrency, crawlUrl } from "./services/crawl";

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
