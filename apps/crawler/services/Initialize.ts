import { Database } from "bun:sqlite";
import seedUrls from "../utils/seedUrls";
import {
  isLikelyArticleUrl,
  normalizeQueueUrl,
  shouldDiscardUrl,
} from "./urlFilters";

export interface CrawlerConfig {
  maxConcurrentCrawls: number;
  crawlDelayMs: number;
  requestTimeoutMs: number;
  maxPagesPerDomain: number;
  minContentLength: number;
}

type QueueInsertStats = {
  inserted: number;
  duplicates: number;
  invalid: number;
  discarded: number;
};

export class Initialize {
  private db: Database;
  private config: CrawlerConfig;
  private readonly seenUrls = new Set<string>();

  constructor(dbPath: string = "./data/search-engine.db") {
    this.db = new Database(dbPath);
    this.config = {
      maxConcurrentCrawls: 8,
      crawlDelayMs: 300,
      requestTimeoutMs: 12_000,
      maxPagesPerDomain: 100_000,
      minContentLength: 500,
    };
    this.createTables();
    this.bootstrapSeenUrls();
    this.initializeSeedUrls(seedUrls);

    console.log("   Initialize complete");
    console.log(`   Seed URLs: ${this.getSeedCount().total}`);
    console.log(`   Uncrawled seeds: ${this.getSeedCount().remaining}`);
    console.log(`   Discovered URLs: ${this.getQueueSize().total}`);
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        url_normalized TEXT NOT NULL,
        domain TEXT,
        title TEXT NOT NULL,
        content TEXT,
        content_hash TEXT UNIQUE,
        is_indexed INTEGER DEFAULT 0,
        crawl_timestamp TEXT,
        published_date TEXT,
        UNIQUE(url_normalized)
      );
  
      CREATE TABLE IF NOT EXISTS signals (
        article_id TEXT PRIMARY KEY,
        quality_score REAL DEFAULT 0,
        readability_score REAL DEFAULT 0,
        authority_score REAL DEFAULT 0,
        freshness_score REAL DEFAULT 0,
        popularity_score REAL DEFAULT 0,
        computed_at TEXT,
        FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
      );
  
      CREATE TABLE IF NOT EXISTS seed_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        domain TEXT,
        crawled INTEGER DEFAULT 0,
        crawled_at TEXT,
        articles_found INTEGER DEFAULT 0,
        links_discovered INTEGER DEFAULT 0,
        added_at TEXT DEFAULT (strftime('%s','now'))
      );
  
      CREATE TABLE IF NOT EXISTS url_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        domain TEXT,
        source TEXT DEFAULT 'discovered',
        priority INTEGER DEFAULT 0,
        crawled INTEGER DEFAULT 0,
        crawled_at TEXT,
        added_at TEXT DEFAULT (strftime('%s','now'))
      );
  
      CREATE INDEX IF NOT EXISTS idx_seed_urls_crawled
        ON seed_urls(crawled);
  
      CREATE INDEX IF NOT EXISTS idx_url_queue_crawled
        ON url_queue(crawled);
  
      CREATE INDEX IF NOT EXISTS idx_url_queue_priority
        ON url_queue(priority DESC, added_at ASC);
  
      CREATE INDEX IF NOT EXISTS idx_articles_url
        ON articles(url);
  
      CREATE INDEX IF NOT EXISTS idx_articles_domain
        ON articles(domain);
  
      CREATE INDEX IF NOT EXISTS idx_articles_content_hash
        ON articles(content_hash);
  
      CREATE INDEX IF NOT EXISTS idx_articles_is_indexed
        ON articles(is_indexed);
    `);
  }

  private bootstrapSeenUrls(): void {
    const seedRows = this.db
      .prepare("SELECT url FROM seed_urls")
      .all() as Array<{ url: string }>;
    const queueRows = this.db
      .prepare("SELECT url FROM url_queue")
      .all() as Array<{ url: string }>;
    const articleRows = this.db
      .prepare("SELECT COALESCE(url_normalized, url) AS url FROM articles")
      .all() as Array<{ url: string }>;

    for (const row of [...seedRows, ...queueRows, ...articleRows]) {
      this.seenUrls.add(normalizeQueueUrl(row.url));
    }
  }

  private initializeSeedUrls(urls: string[]) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO seed_urls (url, domain)
      VALUES (?, ?)
    `);

    let added = 0;
    let skippedDuplicate = 0;
    let skippedInvalid = 0;

    const insertMany = this.db.transaction((nextUrls: string[]) => {
      for (const rawUrl of nextUrls) {
        try {
          const normalizedUrl = normalizeQueueUrl(rawUrl);
          const parsed = new URL(normalizedUrl);

          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            skippedInvalid++;
            continue;
          }

          if (this.seenUrls.has(normalizedUrl)) {
            skippedDuplicate++;
            continue;
          }

          const result = stmt.run(normalizedUrl, parsed.hostname);
          if (result.changes > 0) {
            this.seenUrls.add(normalizedUrl);
            added++;
          } else {
            skippedDuplicate++;
          }
        } catch {
          skippedInvalid++;
          continue;
        }
      }
    });

    insertMany(urls);

    if (added > 0) {
      console.log(`   Seeds: +${added} new, ${skippedDuplicate} existing, ${skippedInvalid} invalid`);
    }
  }

  getNextSeedUrl(): string | null {
    return this.getNextSeedUrls(1)[0] ?? null;
  }

  getNextSeedUrls(limit: number): string[] {
    const rows = this.db
      .prepare(
        `
        SELECT url
        FROM seed_urls
        WHERE crawled = 0
        ORDER BY rowid ASC
        LIMIT ?
      `,
      )
      .all(limit) as Array<{ url: string }>;

    return rows.map((row) => row.url);
  }

  getNextDiscoveredUrl(): string | null {
    return this.getNextDiscoveredUrls(1)[0] ?? null;
  }

  getNextDiscoveredUrls(limit: number): string[] {
    // Just SELECT, don't mark yet
    const rows = this.db
      .prepare(
        `
      SELECT url FROM url_queue
      WHERE crawled = 0
      ORDER BY priority DESC, rowid ASC
      LIMIT ?
    `,
      )
      .all(limit) as Array<{ url: string }>;

    return rows.map((row) => row.url);
  }

  markSeedAsCrawled(url: string, articlesFound: number = 0): void {
    this.db
      .prepare(
        `
      UPDATE seed_urls
      SET crawled = 1, crawled_at = CURRENT_TIMESTAMP, articles_found = ?
      WHERE url = ?
    `,
      )
      .run(articlesFound, url);
  }

  addDiscoveredUrls(urls: string[], sourceDomain: string): QueueInsertStats {
    if (urls.length === 0) {
      return { inserted: 0, duplicates: 0, invalid: 0, discarded: 0 };
    }

    console.log(
      `addDiscoveredUrls: received ${urls.length} URLs from ${sourceDomain}, seenUrls size: ${this.seenUrls.size}`,
    );

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO url_queue (url, domain, source, crawled)
      VALUES (?, ?, 'discovered', 0)
    `);

    const stats: QueueInsertStats = {
      inserted: 0,
      duplicates: 0,
      invalid: 0,
      discarded: 0,
    };

    const insertMany = this.db.transaction((nextUrls: string[]) => {
      for (const rawUrl of nextUrls) {
        try {
          const normalizedUrl = normalizeQueueUrl(rawUrl);
          if (
            shouldDiscardUrl(normalizedUrl) ||
            !isLikelyArticleUrl(normalizedUrl, sourceDomain)
          ) {
            stats.discarded++;
            continue;
          }

          if (this.seenUrls.has(normalizedUrl)) {
            stats.duplicates++;
            continue;
          }

          const domain = new URL(normalizedUrl).hostname;
          const result = stmt.run(normalizedUrl, domain);
          if (result.changes > 0) {
            this.seenUrls.add(normalizedUrl);
            stats.inserted++;
          } else {
            stats.duplicates++;
          }
        } catch {
          stats.invalid++;
        }
      }
    });

    insertMany(urls);

    const queueCount = (
      this.db.prepare("SELECT COUNT(*) as count FROM url_queue").get() as {
        count: number;
      }
    ).count;
    console.log(
      `  addDiscoveredUrls result: +${stats.inserted} inserted, ${stats.duplicates} dups, ${stats.discarded} discarded, ${stats.invalid} invalid | url_queue total: ${queueCount}`,
    );

    return stats;
  }

  markDiscoveredAsCrawled(url: string): void {
    this.db.prepare(`
      UPDATE url_queue SET crawled = 1, crawled_at = CURRENT_TIMESTAMP
      WHERE url = ?
    `).run(url);
  }

  updateSeedStats(seedUrl: string, linksDiscovered: number): void {
    this.db
      .prepare(
        `
      UPDATE seed_urls
      SET links_discovered = ?
      WHERE url = ?
    `,
      )
      .run(linksDiscovered, seedUrl);
  }

  getSeedCount(): { total: number; crawled: number; remaining: number } {
    const totalResult = this.db
      .prepare("SELECT COUNT(*) as count FROM seed_urls")
      .get() as { count: number };
    const crawledResult = this.db
      .prepare("SELECT COUNT(*) as count FROM seed_urls WHERE crawled = 1")
      .get() as { count: number };

    return {
      total: totalResult.count,
      crawled: crawledResult.count,
      remaining: totalResult.count - crawledResult.count,
    };
  }

  getQueueSize(): { total: number; crawled: number; remaining: number } {
    const totalResult = this.db
      .prepare("SELECT COUNT(*) as count FROM url_queue")
      .get() as { count: number };
    const crawledResult = this.db
      .prepare("SELECT COUNT(*) as count FROM url_queue WHERE crawled = 1")
      .get() as { count: number };

    return {
      total: totalResult.count,
      crawled: crawledResult.count,
      remaining: totalResult.count - crawledResult.count,
    };
  }

  getArticleCount(): number {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM articles")
      .get() as { count: number };
    return result.count;
  }

  getCrawlStatus(): {
    seeds: { total: number; crawled: number; remaining: number };
    discovered: { total: number; crawled: number; remaining: number };
    articles: number;
  } {
    return {
      seeds: this.getSeedCount(),
      discovered: this.getQueueSize(),
      articles: this.getArticleCount(),
    };
  }

  getConfig(): CrawlerConfig {
    return this.config;
  }

  getDatabase(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
